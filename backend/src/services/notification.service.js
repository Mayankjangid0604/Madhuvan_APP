const db = require('../config/db.sqlite');
const settingsService = require('./settings.service');
const msg91Service = require('./msg91.service');
const invoiceService = require('./invoice.service');
const admissionFormService = require('./admissionForm.service');
const signedLink = require('../utils/signedLink.util');

const toNum = (v) => Number(v) || 0;
const fmtINR = (n) => `₹${Math.round(toNum(n)).toLocaleString('en-IN')}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const fillTemplate = (tpl, vars) => {
  let s = String(tpl || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    s = s.split(`{${k}}`).join(String(v ?? ''));
  });
  return s;
};

const computeRemaining = (fee) =>
  toNum(fee.final_amount) + toNum(fee.previous_dues) + toNum(fee.penalty_amount) +
  toNum(fee.fine_amount) + toNum(fee.property_damage_amount) + toNum(fee.money_given_amount) - toNum(fee.paid_amount);

const getStudent = (studentId) =>
  db.db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(studentId);

const logNotification = (studentId, type, method, status, message) => {
  try {
    db.db.prepare(`
      INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(studentId, type, method, status, message || null);
  } catch (e) {
    console.warn('Failed to write notification log:', e.message);
  }
};

const logReminder = (studentId, feeId, type, method, status) => {
  try {
    db.db.prepare(`
      INSERT INTO reminder_logs (student_id, fee_id, reminder_type, reminder_method, reminder_status, sent_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(studentId, feeId, type, method, status);
  } catch (e) {
    console.warn('Failed to write reminder log:', e.message);
  }
};

/**
 * Resolve which contact to message: father -> mother -> local guardian.
 * A contact only "exists" if it has a mobile or an email on file; if the
 * chosen contact is missing one channel, that channel falls back further
 * down the chain (e.g. father has no email but mother does).
 */
const resolveContact = (student) => {
  const candidates = [
    { role: 'father', name: student.father_name, mobile: student.father_mobile, email: student.father_email },
    { role: 'mother', name: student.mother_name, mobile: student.mother_mobile, email: student.mother_email },
    { role: 'guardian', name: student.local_guardian_name, mobile: student.local_guardian_mobile, email: student.local_guardian_email }
  ];
  const primary = candidates.find((c) => c.mobile || c.email) || candidates[0];
  const email = primary.email || candidates.find((c) => c.email)?.email || null;
  const mobile = primary.mobile || candidates.find((c) => c.mobile)?.mobile || null;
  return { role: primary.role, name: primary.name, mobile, email };
};
exports.resolveContact = resolveContact;

// ============================================
// ADMISSION: email (invoice + admission form) + SMS
// ============================================
exports.sendAdmissionNotifications = async (studentId) => {
  const student = getStudent(studentId);
  if (!student) return;

  const contact = resolveContact(student);
  const fee = db.db.prepare(`SELECT * FROM student_fees WHERE student_id = ? ORDER BY fee_date ASC LIMIT 1`).get(studentId);
  const hostelInfo = await settingsService.getHostelInfo() || {};
  const templates = await settingsService.getTemplates();

  const vars = {
    student_name: student.student_name,
    contact_name: contact.name || '',
    fee_amount: fee ? fmtINR(computeRemaining(fee)) : '0',
    due_date: fee?.due_date ? formatDate(fee.due_date) : '-',
    hostel_name: hostelInfo.hostel_name || 'Hostel Management'
  };

  if (contact.email) {
    try {
      const attachments = [];
      const admissionFormPath = await admissionFormService.generateAdmissionFormPDF(studentId);
      attachments.push({ filename: `Admission_Form_${studentId}.pdf`, path: admissionFormPath });
      if (fee) {
        const { filePath } = await invoiceService.generateBillPDF(fee.fee_id);
        attachments.push({ filename: `Invoice_${fee.fee_id}.pdf`, path: filePath });
      }

      const result = await msg91Service.sendEmail({
        to: contact.email,
        toName: contact.name,
        subject: fillTemplate(templates.admission_email.subject, vars),
        html: fillTemplate(templates.admission_email.body, vars).replace(/\n/g, '<br>'),
        attachments
      });
      logNotification(studentId, 'admission', 'email', result.success ? 'sent' : 'failed', result.success ? `Email sent to ${contact.email}` : (result.error || result.reason));
    } catch (e) {
      logNotification(studentId, 'admission', 'email', 'failed', e.message);
    }
  } else {
    logNotification(studentId, 'admission', 'email', 'skipped', 'No email on file for father/mother/guardian');
  }

  if (contact.mobile) {
    const config = await settingsService.getMsg91Config();
    const result = await msg91Service.sendSms({
      mobile: contact.mobile,
      templateId: config.sms?.templates?.admission,
      variables: { VAR1: student.student_name, VAR2: vars.fee_amount, VAR3: vars.due_date }
    });
    logNotification(studentId, 'admission', 'sms', result.success ? 'sent' : 'failed', result.success ? `SMS sent to ${contact.mobile}` : (result.error || result.reason));
  } else {
    logNotification(studentId, 'admission', 'sms', 'skipped', 'No mobile on file');
  }
};

// ============================================
// FEE RECEIPT: email (receipt attached) + SMS + WhatsApp (receipt document)
// ============================================
exports.sendFeeReceiptNotifications = async ({ studentId, feeId, paymentId }) => {
  const student = getStudent(studentId);
  if (!student) return;

  const payment = paymentId
    ? db.db.prepare(`SELECT * FROM fee_payments WHERE payment_id = ?`).get(paymentId)
    : db.db.prepare(`SELECT * FROM fee_payments WHERE fee_id = ? ORDER BY payment_id DESC LIMIT 1`).get(feeId);
  if (!payment) return;

  const contact = resolveContact(student);
  const hostelInfo = await settingsService.getHostelInfo() || {};
  const templates = await settingsService.getTemplates();

  const vars = {
    student_name: student.student_name,
    contact_name: contact.name || '',
    fee_amount: fmtINR(payment.payment_amount),
    payment_date: formatDate(payment.payment_date),
    receipt_number: payment.invoice_number || `PAY-${payment.payment_id}`,
    hostel_name: hostelInfo.hostel_name || 'Hostel Management'
  };

  let receiptPath = null;
  try {
    const generated = await invoiceService.generateReceiptForPayment(payment.payment_id);
    receiptPath = generated.filePath;
  } catch (e) {
    console.warn('Receipt PDF generation failed:', e.message);
  }

  if (contact.email) {
    try {
      const result = await msg91Service.sendEmail({
        to: contact.email,
        toName: contact.name,
        subject: fillTemplate(templates.receipt_email.subject, vars),
        html: fillTemplate(templates.receipt_email.body, vars).replace(/\n/g, '<br>'),
        attachments: receiptPath ? [{ filename: `Receipt_${vars.receipt_number}.pdf`, path: receiptPath }] : []
      });
      logNotification(studentId, 'fee_receipt', 'email', result.success ? 'sent' : 'failed', result.success ? `Email sent to ${contact.email}` : (result.error || result.reason));
    } catch (e) {
      logNotification(studentId, 'fee_receipt', 'email', 'failed', e.message);
    }
  } else {
    logNotification(studentId, 'fee_receipt', 'email', 'skipped', 'No email on file');
  }

  if (contact.mobile) {
    const config = await settingsService.getMsg91Config();
    const result = await msg91Service.sendSms({
      mobile: contact.mobile,
      templateId: config.sms?.templates?.fee_receipt,
      variables: { VAR1: student.student_name, VAR2: vars.fee_amount, VAR3: vars.receipt_number }
    });
    logNotification(studentId, 'fee_receipt', 'sms', result.success ? 'sent' : 'failed', result.success ? `SMS sent to ${contact.mobile}` : (result.error || result.reason));
  } else {
    logNotification(studentId, 'fee_receipt', 'sms', 'skipped', 'No mobile on file');
  }

  if (contact.mobile && receiptPath) {
    const config = await settingsService.getMsg91Config();
    if (config.publicBaseUrl) {
      try {
        const token = signedLink.sign(`receipt:${payment.payment_id}`);
        const documentUrl = `${config.publicBaseUrl.replace(/\/$/, '')}/api/public/receipt/${payment.payment_id}?token=${token}`;
        const result = await msg91Service.sendWhatsappDocument({
          mobile: contact.mobile,
          documentUrl,
          filename: `Receipt_${vars.receipt_number}.pdf`,
          bodyParams: [student.student_name, vars.fee_amount, vars.receipt_number]
        });
        logNotification(studentId, 'fee_receipt', 'whatsapp', result.success ? 'sent' : 'failed', result.success ? `WhatsApp sent to ${contact.mobile}` : (result.error || result.reason));
      } catch (e) {
        logNotification(studentId, 'fee_receipt', 'whatsapp', 'failed', e.message);
      }
    } else {
      logNotification(studentId, 'fee_receipt', 'whatsapp', 'skipped', 'publicBaseUrl not configured');
    }
  }
};

// ============================================
// DUE REMINDER (email only): day 2 and day 4 after invoice generated
// ============================================
exports.sendDueReminderEmail = async (studentId, feeId, stage) => {
  const student = getStudent(studentId);
  const fee = db.db.prepare(`SELECT * FROM student_fees WHERE fee_id = ?`).get(feeId);
  if (!student || !fee) return { success: false, reason: 'Not found' };

  const contact = resolveContact(student);
  if (!contact.email) {
    logReminder(studentId, feeId, stage, 'email', 'skipped');
    return { success: false, reason: 'No email on file' };
  }

  const hostelInfo = await settingsService.getHostelInfo() || {};
  const templates = await settingsService.getTemplates();
  const vars = {
    student_name: student.student_name,
    contact_name: contact.name || '',
    fee_amount: fmtINR(computeRemaining(fee)),
    due_date: formatDate(fee.due_date),
    hostel_name: hostelInfo.hostel_name || 'Hostel Management'
  };

  const { filePath } = await invoiceService.generateBillPDF(feeId);
  const result = await msg91Service.sendEmail({
    to: contact.email,
    toName: contact.name,
    subject: fillTemplate(templates.due_reminder_email.subject, vars),
    html: fillTemplate(templates.due_reminder_email.body, vars).replace(/\n/g, '<br>'),
    attachments: [{ filename: `Invoice_${feeId}.pdf`, path: filePath }]
  });

  logNotification(studentId, 'due_reminder', 'email', result.success ? 'sent' : 'failed', result.success ? `Email sent to ${contact.email}` : (result.error || result.reason));
  logReminder(studentId, feeId, stage, 'email', result.success ? 'sent' : 'failed');
  return result;
};

// ============================================
// OVERDUE REMINDER (email only, daily): updated penalty invoice attached
// ============================================
exports.sendOverdueReminderEmail = async (studentId, feeId) => {
  const student = getStudent(studentId);
  const fee = db.db.prepare(`SELECT * FROM student_fees WHERE fee_id = ?`).get(feeId);
  if (!student || !fee) return { success: false, reason: 'Not found' };

  const contact = resolveContact(student);
  if (!contact.email) {
    logReminder(studentId, feeId, 'overdue', 'email', 'skipped');
    return { success: false, reason: 'No email on file' };
  }

  const hostelInfo = await settingsService.getHostelInfo() || {};
  const templates = await settingsService.getTemplates();
  const vars = {
    student_name: student.student_name,
    contact_name: contact.name || '',
    fee_amount: fmtINR(computeRemaining(fee)),
    penalty_amount: fmtINR(fee.penalty_amount),
    due_date: formatDate(fee.due_date),
    hostel_name: hostelInfo.hostel_name || 'Hostel Management'
  };

  const { filePath } = await invoiceService.generateBillPDF(feeId);
  const result = await msg91Service.sendEmail({
    to: contact.email,
    toName: contact.name,
    subject: fillTemplate(templates.overdue_email.subject, vars),
    html: fillTemplate(templates.overdue_email.body, vars).replace(/\n/g, '<br>'),
    attachments: [{ filename: `Invoice_${feeId}_OVERDUE.pdf`, path: filePath }]
  });

  logNotification(studentId, 'overdue_reminder', 'email', result.success ? 'sent' : 'failed', result.success ? `Email sent to ${contact.email}` : (result.error || result.reason));
  logReminder(studentId, feeId, 'overdue', 'email', result.success ? 'sent' : 'failed');
  return result;
};

// ============================================
// Manual / ad-hoc SMS (used by the admin "send reminder" screen)
// ============================================
exports.sendSMS = async (mobile, message) => {
  const config = await settingsService.getMsg91Config();
  const templateId = config.sms?.templates?.manual || config.sms?.templates?.admission;
  return msg91Service.sendSms({ mobile, templateId, variables: { VAR1: message } });
};

// ============================================
// Test senders (Settings -> MSG91 configuration screen)
// ============================================
exports.sendTestEmail = async (to) => {
  const config = await settingsService.getMsg91Config();
  if (!config.enabled || !config.authKey) {
    throw new Error('MSG91 is not configured');
  }
  const result = await msg91Service.sendEmail({
    to,
    subject: 'Test Email Successful',
    html: '<b>MSG91 email configuration is working correctly.</b>'
  });
  if (!result.success) throw new Error(result.error || result.reason || 'Send failed');
  return result;
};

exports.sendTestSMS = async (to) => {
  const config = await settingsService.getMsg91Config();
  if (!config.enabled || !config.authKey) {
    throw new Error('MSG91 is not configured');
  }
  const templateId = config.sms?.templates?.admission || config.sms?.templates?.fee_receipt;
  if (!templateId) {
    throw new Error('No MSG91 SMS template configured yet');
  }
  const result = await msg91Service.sendSms({
    mobile: to,
    templateId,
    variables: { VAR1: 'Test', VAR2: 'Test SMS', VAR3: '-' }
  });
  if (!result.success) throw new Error(result.error || result.reason || 'Send failed');
  return result;
};

// ============================================
// Notification logs (for the admin activity screen)
// ============================================
exports.getNotificationLogs = async (query = {}) => {
  const { student_id, notification_type, limit } = query;
  const conditions = [];
  const params = [];
  if (student_id) { conditions.push('student_id = ?'); params.push(student_id); }
  if (notification_type) { conditions.push('notification_type = ?'); params.push(notification_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const cap = Math.min(Number(limit) || 100, 500);
  return db.db.prepare(`
    SELECT * FROM notification_logs ${where} ORDER BY sent_at DESC LIMIT ${cap}
  `).all(...params);
};

/**
 * No-op kept for backward compatibility - MSG91 is a stateless HTTP API,
 * there is no persistent client/transporter to reinitialize.
 */
exports.reinitialize = async () => {};

module.exports = exports;
