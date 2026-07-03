// 90-day re-admission cron
// On the 1st of every month, for every active student whose stay-length would
// exceed 90 days as of that day, create a NEW student record (fresh admission)
// with:
//   - joining_date = 1st of this month
//   - all personal info copied from the original student
//   - previous_student_id = old student_id
//   - fee_start_month = 1st of this month
// The old record is soft-closed (status='inactive', closed_at, closed_reason).
// Active room allocation is transferred to the new student_id so the bed stays occupied.
//
// This exists so that hostel-accommodation GST rules that treat stays > 90 days
// differently can be side-stepped by rolling into a new admission every 3 months.

const cron = require("node-cron");
const db = require("../config/db.sqlite");

const daysBetween = (startISO, endISO) => {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.floor((e - s) / (1000 * 60 * 60 * 24));
};

const firstOfCurrentMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

exports.runNinetyDayReadmit = (opts = {}) => {
  const today = opts.today || firstOfCurrentMonthISO();
  const toDate = new Date(today);
  // Only students whose stay would cross 90 days going forward from `today`.
  // A student joined N days ago; if N + days-in-current-month > 90, we roll.
  // Simpler policy: any active student whose (today - joining_date) > 60 days
  // — because if they've already stayed 60+ days, by the end of the month they'll be past 90.
  const students = db.db.prepare(`
    SELECT * FROM students
    WHERE status = 'active'
      AND (date_of_leaving IS NULL OR date_of_leaving = '')
      AND date_of_joining IS NOT NULL
  `).all();

  let rolled = 0;
  const details = [];

  const tx = db.db.transaction(() => {
    for (const s of students) {
      const days = daysBetween(s.date_of_joining, today);
      // Anyone whose stay from date_of_joining to end-of-current-month exceeds 90.
      const endOfMonth = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0)
        .toISOString().split("T")[0];
      const daysUntilEnd = daysBetween(s.date_of_joining, endOfMonth);
      if (daysUntilEnd <= 90) continue;

      // 1) Insert a new student row copying most personal fields from old.
      const insertRes = db.db.prepare(`
        INSERT INTO students (
          form_date, student_name, date_of_birth, student_mobile,
          father_email, mother_email, class_or_coaching, institute_name,
          date_of_joining, father_name, father_mobile, mother_name, mother_mobile,
          local_guardian_name, local_guardian_relation, local_guardian_mobile,
          id_type, id_number, address_line1, address_line2, address_line3,
          photo_url, monthly_fee, security_deposit, fee_start_month,
          fee_end_month, fee_term_months, has_discount, discount_type,
          discount_value, discount_applicable, discount_months,
          discount_on_full_month, fee_type_cycle, next_fee_due_date,
          original_security_deposit, payment_mode, previous_student_id, status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active')
      `).run(
        today, s.student_name, s.date_of_birth, s.student_mobile,
        s.father_email, s.mother_email, s.class_or_coaching, s.institute_name,
        today, s.father_name, s.father_mobile, s.mother_name, s.mother_mobile,
        s.local_guardian_name, s.local_guardian_relation, s.local_guardian_mobile,
        s.id_type, s.id_number, s.address_line1, s.address_line2, s.address_line3,
        s.photo_url, s.monthly_fee, 0 /* security already collected on old record */,
        today, s.fee_end_month, s.fee_term_months, s.has_discount,
        s.discount_type, s.discount_value, s.discount_applicable, s.discount_months,
        s.discount_on_full_month, s.fee_type_cycle, null,
        s.original_security_deposit, s.payment_mode || "cash", s.student_id
      );

      const newId = insertRes.lastInsertRowid;

      // 2) Move active room allocation to the new student_id so the bed stays theirs.
      try {
        db.db.prepare(`
          UPDATE room_allocation
             SET student_id = ?
           WHERE student_id = ? AND allocation_status = 'active'
        `).run(newId, s.student_id);
      } catch (e) {
        console.warn(`⚠️ Could not transfer allocation for student ${s.student_id}:`, e.message);
      }

      // 3) Close the old student record.
      db.db.prepare(`
        UPDATE students
           SET status = 'inactive',
               closed_at = CURRENT_TIMESTAMP,
               closed_reason = '90-day re-admission (rolled to new student ID ' || ? || ')',
               date_of_leaving = ?
         WHERE student_id = ?
      `).run(newId, today, s.student_id);

      rolled++;
      details.push({ old_id: s.student_id, new_id: newId, days_at_end_of_month: daysUntilEnd });
    }
  });
  tx();

  return { rolled, details, run_at: new Date().toISOString() };
};

exports.startNinetyDayReadmitCron = () => {
  // 00:15 on the 1st of every month
  cron.schedule("15 0 1 * *", () => {
    try {
      const result = exports.runNinetyDayReadmit();
      console.log(`🔄 90-day re-admission cron: rolled ${result.rolled} student(s)`);
      if (result.details.length) {
        for (const d of result.details) {
          console.log(`   ↪ old #${d.old_id} → new #${d.new_id} (${d.days_at_end_of_month} days)`);
        }
      }
    } catch (err) {
      console.error("❌ 90-day re-admission cron failed:", err.message);
    }
  }, { timezone: "Asia/Kolkata" });
};
