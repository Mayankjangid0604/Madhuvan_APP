// Fee communication schedule (email only):
//   fee_date + 2 days  -> due reminder ("due in a few days")
//   fee_date + 4 days  -> due reminder (last-day style reminder)
//   fee_status OVERDUE -> daily reminder with the updated penalty invoice,
//                         for as long as the fee stays unpaid
//
// Admission notifications and fee-receipt notifications are sent immediately
// from the relevant controllers, not from this cron.
const cron = require("node-cron");
const db = require("../config/db.sqlite");
const feeService = require("../services/fee.service");
const notificationService = require("../services/notification.service");

const getFeesForDueReminder = (daysAfterInvoice) =>
  db.db.prepare(`
    SELECT sf.fee_id, sf.student_id
    FROM student_fees sf
    JOIN students s ON s.student_id = sf.student_id
    WHERE sf.fee_status IN ('DUE', 'PARTIAL')
      AND s.status = 'active' AND s.date_of_leaving IS NULL
      AND date(sf.fee_date, '+' || ? || ' days') = date('now')
  `).all(daysAfterInvoice);

const getOverdueFees = () =>
  db.db.prepare(`
    SELECT sf.fee_id, sf.student_id
    FROM student_fees sf
    JOIN students s ON s.student_id = sf.student_id
    WHERE sf.fee_status = 'OVERDUE'
      AND s.status = 'active' AND s.date_of_leaving IS NULL
  `).all();

const alreadySentToday = (feeId, reminderType) =>
  !!db.db.prepare(`
    SELECT 1 FROM reminder_logs
    WHERE fee_id = ? AND reminder_type = ? AND reminder_status = 'sent' AND date(sent_at) = date('now')
  `).get(feeId, reminderType);

const runDueReminders = async () => {
  for (const [daysAfterInvoice, reminderType] of [[2, 'due_day2'], [4, 'due_day4']]) {
    const fees = getFeesForDueReminder(daysAfterInvoice);
    for (const fee of fees) {
      if (alreadySentToday(fee.fee_id, reminderType)) continue;
      try {
        await notificationService.sendDueReminderEmail(fee.student_id, fee.fee_id, reminderType);
      } catch (err) {
        console.warn(`Due reminder (${reminderType}) failed for fee ${fee.fee_id}:`, err.message);
      }
    }
  }
};

const runOverdueReminders = async () => {
  try {
    feeService.applyPenalties();
  } catch (err) {
    console.warn('Overdue cron: penalty calculation failed:', err.message);
  }

  const fees = getOverdueFees();
  for (const fee of fees) {
    if (alreadySentToday(fee.fee_id, 'overdue')) continue;
    try {
      await notificationService.sendOverdueReminderEmail(fee.student_id, fee.fee_id);
    } catch (err) {
      console.warn(`Overdue reminder failed for fee ${fee.fee_id}:`, err.message);
    }
  }
};

exports.startFeeCommunicationCron = () => {
  const tz = { timezone: "Asia/Kolkata" };
  cron.schedule("0 9 * * *", () => {
    console.log("📧 Running fee communication cron (due + overdue reminders)...");
    runDueReminders().catch((e) => console.error("Due reminder cron failed:", e.message));
    runOverdueReminders().catch((e) => console.error("Overdue reminder cron failed:", e.message));
  }, tz);

  console.log("📧 Fee communication cron started (daily at 09:00 Asia/Kolkata)");
};

// Manual triggers exposed for testing
exports.runDueReminders = runDueReminders;
exports.runOverdueReminders = runOverdueReminders;
