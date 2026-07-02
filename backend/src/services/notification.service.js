const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const db = require('../config/db.sqlite');
const settingsService = require("./settings.service");
const invoiceService = require('./invoice.service');

// Global transporter - will be updated dynamically
let emailTransporter = null;
let twilioClient = null;

/**
 * Initialize email transporter from database settings
 */
const initializeEmailTransporter = async () => {
  try {
    const emailConfig = await settingsService.getEmailConfig();

    if (!emailConfig.enabled || !emailConfig.user || !emailConfig.password) {
      console.log('⚠️ Email not configured');
      emailTransporter = null;
      return;
    }

    // 🔥 DESTROY OLD TRANSPORTER
    emailTransporter = null;

    const secure = Number(emailConfig.port) === 465;

    emailTransporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: Number(emailConfig.port),
      secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password
      }
    });

    await emailTransporter.verify();
    console.log('✅ Email transporter verified');

  } catch (err) {
    console.error('❌ Email init failed:', err.message);
    emailTransporter = null;
  }
};

/**
 * Initialize SMS client from database settings
 */
const initializeTwilioClient = async () => {
  try {
    const smsConfig = await settingsService.getSmsConfig();
    
    // Check if SMS is enabled and configured
    if (!smsConfig.enabled || !smsConfig.accountSid || !smsConfig.authToken) {
      console.log('⚠️  SMS not configured - SMS reminders disabled');
      twilioClient = null;
      return;
    }

    const twilio = require('twilio');
    twilioClient = twilio(smsConfig.accountSid, smsConfig.authToken);
    console.log('✅ SMS configured from database settings');
  } catch (error) {
    console.log('⚠️  SMS initialization failed:', error.message);
    twilioClient = null;
  }
};

/**
 * Initialize both email and SMS on startup
 */
const initialize = async () => {
  await initializeEmailTransporter();
  await initializeTwilioClient();
};

// Initialize on module load
initialize();

/**
 * Re-initialize after settings change
 */
exports.reinitialize = async () => {
  console.log('🔄 Reinitializing notification services...');
  await initialize();
};

/**
 * Build Email Content using template
 */
const buildEmailContent = async (student, fee) => {
  const hostelInfo = await settingsService.getHostelInfo() || {};
  const templates = await settingsService.getTemplates();
  const template = templates.email;
  const emailConfig = await settingsService.getEmailConfig();
  
  // Replace variables
  let subject = template.subject
    .replace(/{student_name}/g, student.student_name || '')
    .replace(/{hostel_name}/g, hostelInfo.hostel_name || '');

  let body = template.body
    .replace(/{student_name}/g, student.student_name || '')
    .replace(/{father_name}/g, student.father_name || '')
    .replace(/{mother_name}/g, student.mother_name || '')
    .replace(/{fee_amount}/g, fee.penalty_amount > 0
      ? `${fee.fee_amount} + ₹${fee.penalty_amount} = ₹${fee.fee_amount + fee.penalty_amount}`
      : fee.fee_amount
    )
    .replace(/{due_date}/g, fee.due_date || '')
    .replace(/{fee_status}/g, fee.fee_status || '')
    .replace(/{hostel_name}/g, hostelInfo.hostel_name || '')
    .replace(/{hostel_phone}/g, hostelInfo.phone || '')
    .replace(/{hostel_email}/g, hostelInfo.email || '');
  
  return {
    subject,
    body,
    fromName: emailConfig.fromName || "Hostel Management",
    fromEmail: emailConfig.fromEmail || emailConfig.user
  };
};

/**
 * Build SMS Content using template
 */
const buildSMSContent = async (student, fee) => {
  const templates = await settingsService.getTemplates();
  const template = templates.sms;
  
  let message = template.message
    .replace('{student_name}', student.student_name)
    .replace('{father_name}', student.father_name)
    .replace('{mother_name}', student.mother_name || '')
    .replace('{fee_amount}', fee.fee_amount)
    .replace('{due_date}', fee.due_date)
    .replace('{fee_status}', fee.fee_status);
  
  return message;
};

/**
 * Send Email to Father
 */
exports.sendEmailReminder = async (studentId, feeDetails) => {
  try {
    // Re-initialize if not already done
    if (!emailTransporter) {
      await initializeEmailTransporter();
    }

    if (!emailTransporter) {
      console.log('Email not configured');
      return { success: false, reason: 'Email not configured' };
    }

    const student = db.db.prepare(`
      SELECT s.student_name, s.father_name, s.father_email,
             sf.fee_amount, sf.paid_amount, sf.due_date, sf.fee_status, sf.fee_id
      FROM students s
      JOIN student_fees sf ON s.student_id = sf.student_id
      WHERE s.student_id = ? AND sf.fee_id = ?
    `).get(studentId, feeDetails.fee_id);

    if (!student || !student.father_email) {
      console.log(`No email for student ${studentId}`);
      return { success: false, reason: 'No email found' };
    }

    const fee = db.db.prepare(`SELECT * FROM student_fees WHERE fee_id = ?`).get(feeDetails.fee_id);
    
    if (!fee) {
      console.log(`No fee record for fee_id ${feeDetails.fee_id}`);
      return { success: false, reason: 'No fee record found' };
    }

    process.env.EMAIL_MODE = 'true';
    try {
      // Get email content from template
      const { subject, body, fromName, fromEmail } = await buildEmailContent(student, {
        ...fee,
        fee_status: String(fee.fee_status || 'DUE')
      });

      const invoicePath = await invoiceService.generateInvoicePDF(feeDetails.fee_id, { isPaid: false });

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: student.father_email,
        subject: subject,
        html: body.replace(/\n/g, '<br>'),
        attachments: [{
          filename: `invoice_${feeDetails.fee_id}_UNPAID.pdf`,
          path: invoicePath
        }]
      };

      await emailTransporter.sendMail(mailOptions);

      // Log notification
      db.db.prepare(`
        INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
        VALUES (?, 'fee_reminder', 'email', 'sent', ?, datetime('now'))
      `).run(studentId, `Email sent to ${student.father_email}`);

      console.log(`✅ Email sent to ${student.father_email}`);
      return { success: true, email: student.father_email };
    } finally {
      delete process.env.EMAIL_MODE;
    }
  } catch (error) {
    console.error('Email error:', error.message);

    // Log failed notification
    db.db.prepare(`
      INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
      VALUES (?, 'fee_reminder', 'email', 'failed', ?, datetime('now'))
    `).run(studentId, `Email failed: ${error.message}`);

    return { success: false, error: error.message };
  }
};

/**
 * Send SMS to Mother
 */
exports.sendSMSReminder = async (studentId, feeDetails) => {
  try {
    // Re-initialize if not already done
    if (!twilioClient) {
      await initializeTwilioClient();
    }

    if (!twilioClient) {
      console.log('SMS not configured');
      return { success: false, reason: 'SMS not configured' };
    }

    const smsConfig = await settingsService.getSmsConfig();

    const student = db.db.prepare(`
      SELECT s.student_name, s.mother_name, s.mother_mobile, s.father_name,
             sf.fee_amount, sf.paid_amount, sf.due_date, sf.fee_status
      FROM students s
      JOIN student_fees sf ON s.student_id = sf.student_id
      WHERE s.student_id = ? AND sf.fee_id = ?
    `).get(studentId, feeDetails.fee_id);

    if (!student || !student.mother_mobile) {
      console.log(`No mobile for student ${studentId}`);
      return { success: false, reason: 'No mobile found' };
    }

    const message = await buildSMSContent(student, student);

    await twilioClient.messages.create({
      body: message,
      from: smsConfig.fromNumber,
      to: `+91${student.mother_mobile}`
    });

    // Log notification
    db.db.prepare(`
      INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
      VALUES (?, 'fee_reminder', 'sms', 'sent', ?, datetime('now'))
    `).run(studentId, `SMS sent to ${student.mother_mobile}`);

    console.log(`✅ SMS sent to ${student.mother_mobile}`);
    return { success: true, mobile: student.mother_mobile };
  } catch (error) {
    console.error('SMS error:', error.message);
    
    // Log failed notification
    db.db.prepare(`
      INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
      VALUES (?, 'fee_reminder', 'sms', 'failed', ?, datetime('now'))
    `).run(studentId, `SMS failed: ${error.message}`);
    
    return { success: false, error: error.message };
  }
};

/**
 * Send Both Email and SMS
 */
exports.sendFeeReminder = async (studentId, feeId) => {
  const feeDetails = { fee_id: feeId };
  
  const [emailResult, smsResult] = await Promise.all([
    exports.sendEmailReminder(studentId, feeDetails),
    exports.sendSMSReminder(studentId, feeDetails)
  ]);

  return {
    email: emailResult,
    sms: smsResult
  };
};

/**
 * Send Bulk Reminders for Overdue Fees
 */
exports.sendBulkOverdueReminders = async () => {
  try {
    const overdueFees = db.db.prepare(`
      SELECT DISTINCT s.student_id, sf.fee_id
      FROM students s
      JOIN student_fees sf ON s.student_id = sf.student_id
      WHERE sf.fee_status = 'OVERDUE'
      AND s.date_of_leaving IS NULL
      LIMIT 50
    `).all();

    console.log(`📧 Sending reminders to ${overdueFees.length} students...`);

    const results = [];
    for (const fee of overdueFees) {
      const result = await exports.sendFeeReminder(fee.student_id, fee.fee_id);
      results.push(result);
      // Wait 1 second between sends to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { total: overdueFees.length, results };
  } catch (error) {
    console.error('Bulk reminder error:', error.message);
    throw error;
  }
};

/**
 * Send Fee Receipt Email
 */
exports.sendFeeReceiptEmail = async (studentId, feeId) => {
  try {
    if (!emailTransporter) {
      await initializeEmailTransporter();
    }
    if (!emailTransporter) {
      console.log('Email not configured');
      return { success: false, reason: 'Email not configured' };
    }

    const student = db.db.prepare(`
      SELECT s.student_name, s.father_name, s.father_email,
             sf.fee_amount, sf.paid_amount, sf.due_date, sf.fee_status, sf.fee_id
      FROM students s
      JOIN student_fees sf ON s.student_id = sf.student_id
      WHERE s.student_id = ? AND sf.fee_id = ?
    `).get(studentId, feeId);

    if (!student || !student.father_email) {
      console.log(`No email for student ${studentId}`);
      return { success: false, reason: 'No email found' };
    }

    const fee = db.db.prepare(`SELECT * FROM student_fees WHERE fee_id = ?`).get(feeId);
    
    if (!fee) {
      console.log(`No fee record for fee_id ${feeId}`);
      return { success: false, reason: 'No fee record found' };
    }

    process.env.EMAIL_MODE = 'true';
    try {
      const { subject, body, fromName, fromEmail } = await buildEmailContent(student, fee);

      const invoicePath = await invoiceService.generateInvoicePDF(feeId, { isPaid: true });

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: student.father_email,
        subject: `Fee Receipt - ${student.student_name}`,
        html: `Dear ${student.father_name},<br><br>Your payment for fee ID ${feeId} has been received.<br><br>${body.replace(/\n/g, '<br>')}<br><br>Receipt attached.`,
        attachments: [{
          filename: `invoice_${feeId}_PAID.pdf`,
          path: invoicePath
        }]
      };

      await emailTransporter.sendMail(mailOptions);

      // Log notification
      db.db.prepare(`
        INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
        VALUES (?, 'fee_receipt', 'email', 'sent', ?, datetime('now'))
      `).run(studentId, `Receipt email sent to ${student.father_email}`);

      console.log(`✅ Receipt email sent to ${student.father_email}`);
      return { success: true, email: student.father_email };
    } finally {
      delete process.env.EMAIL_MODE;
    }
  } catch (error) {
    console.error('Receipt email error:', error.message);

    // Log failed notification
    db.db.prepare(`
      INSERT INTO notification_logs (student_id, notification_type, notification_method, notification_status, notification_message, sent_at)
      VALUES (?, 'fee_receipt', 'email', 'failed', ?, datetime('now'))
    `).run(studentId, `Receipt email failed: ${error.message}`);

    return { success: false, error: error.message };
  }
};

/**
 * ✅ NEW: Send Email with Attachment (for invoices after payment)
 */
exports.sendEmailWithAttachment = async ({ to, subject, text, html, attachments }) => {
  try {
    // Re-initialize if not already done
    if (!emailTransporter) {
      await initializeEmailTransporter();
    }

    if (!emailTransporter) {
      console.log('⚠️ Email not configured - skipping email');
      return { success: false, reason: 'Email not configured' };
    }

    const emailConfig = await settingsService.getEmailConfig();
    
    // Handle array of recipients
    let recipients;
    if (Array.isArray(to)) {
      recipients = to.filter(Boolean).join(', ');
    } else {
      recipients = to;
    }
    
    if (!recipients) {
      console.log('⚠️ No valid recipients for email');
      return { success: false, reason: 'No valid recipients' };
    }

    const mailOptions = {
      from: `"${emailConfig.fromName || 'Hostel Management'}" <${emailConfig.fromEmail || emailConfig.user}>`,
      to: recipients,
      subject: subject || 'Fee Invoice',
      text: text || '',
      html: html || (text ? text.replace(/\n/g, '<br>') : ''),
      attachments: attachments || []
    };

    await emailTransporter.sendMail(mailOptions);
    
    console.log(`✅ Email with attachment sent to ${recipients}`);
    return { success: true, email: recipients };
    
  } catch (error) {
    console.error('❌ Email with attachment error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send Test Email
 */
exports.sendTestEmail = async (to) => {
  if (!emailTransporter) {
    await initializeEmailTransporter();
  }

  if (!emailTransporter) {
    throw new Error("Email not configured");
  }

  const emailConfig = await settingsService.getEmailConfig();

  await emailTransporter.sendMail({
    from: `"${emailConfig.fromName}" <${emailConfig.fromEmail || emailConfig.user}>`,
    to,
    subject: "Test Email Successful",
    html: "<b>Email configuration is working correctly.</b>"
  });
};

/**
 * Send Test SMS
 */
exports.sendTestSMS = async (to) => {
  if (!twilioClient) {
    await initializeTwilioClient();
  }

  if (!twilioClient) {
    throw new Error("SMS not configured. Please configure Twilio settings first.");
  }

  const smsConfig = await settingsService.getSmsConfig();

  if (!smsConfig.fromNumber) {
    throw new Error("Twilio 'From' number not configured");
  }

  // Ensure phone number has country code
  let phoneNumber = to.trim();
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+91' + phoneNumber.replace(/^0+/, '');
  }

  await twilioClient.messages.create({
    body: "Test SMS from Hostel Management System. SMS configuration is working correctly!",
    from: smsConfig.fromNumber,
    to: phoneNumber
  });

  console.log(`✅ Test SMS sent to ${phoneNumber}`);
};

/**
 * Send SMS (generic)
 */
exports.sendSMS = async (to, message) => {
  if (!twilioClient) {
    await initializeTwilioClient();
  }

  if (!twilioClient) {
    return { success: false, reason: "SMS not configured" };
  }

  const smsConfig = await settingsService.getSmsConfig();

  // Ensure phone number has country code
  let phoneNumber = to.trim();
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+91' + phoneNumber.replace(/^0+/, '');
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: smsConfig.fromNumber,
      to: phoneNumber
    });

    return { success: true, mobile: phoneNumber };
  } catch (error) {
    console.error("SMS send error:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = exports;