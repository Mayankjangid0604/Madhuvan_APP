// services/studentFeeDetails.service.js
const db = require("../config/db.sqlite");

const toNum = (v) => Number(v) || 0;

const getTotalDue = (fee) => {
  return toNum(fee.final_amount) + toNum(fee.previous_dues) + toNum(fee.penalty_amount) +
    toNum(fee.fine_amount) + toNum(fee.property_damage_amount) + toNum(fee.money_given_amount) -
    toNum(fee.advance_used);
};

const getRemaining = (fee) => Math.max(0, getTotalDue(fee) - toNum(fee.paid_amount));

exports.getStudentFeeDetails = (studentId) => {
  // Get student info
  const student = db.db.prepare(`
    SELECT s.*, r.room_no, b.bed_no
    FROM students s
    LEFT JOIN room_allocation a ON a.student_id = s.student_id AND a.allocation_status = 'active'
    LEFT JOIN rooms r ON a.room_id = r.room_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE s.student_id = ?
  `).get(studentId);

  if (!student) return null;

  // Get all fees
  const fees = db.db.prepare(`
    SELECT * FROM student_fees 
    WHERE student_id = ? 
    ORDER BY fee_month DESC, fee_id DESC
  `).all(studentId);

  // Add total_due and remaining to each fee
  const processedFees = fees.map(fee => ({
    ...fee,
    total_due: getTotalDue(fee),
    remaining: getRemaining(fee)
  }));

  // Get all payments with fee details
  const payments = db.db.prepare(`
    SELECT 
      fp.*,
      sf.fee_type,
      sf.fee_month,
      sf.final_amount as fee_amount
    FROM fee_payments fp
    LEFT JOIN student_fees sf ON sf.fee_id = fp.fee_id
    WHERE fp.student_id = ?
    ORDER BY fp.payment_date DESC, fp.payment_id DESC
  `).all(studentId);

  // Calculate summary
  let totalDue = 0;
  let totalPaid = 0;

  for (const fee of processedFees) {
    totalDue += fee.total_due;
    totalPaid += toNum(fee.paid_amount);
  }

  // Get advance balance
  const advanceResult = db.db.prepare(`
    SELECT COALESCE(SUM(amount - used_amount), 0) as total
    FROM student_advances
    WHERE student_id = ? AND status = 'PENDING'
  `).get(studentId);

  // Get pending fines
  const finesResult = db.db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM pending_fines
    WHERE student_id = ? AND status = 'PENDING'
  `).get(studentId);

  // Get pending damages
  const damagesResult = db.db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM property_damage_records
    WHERE student_id = ? AND status = 'PENDING'
  `).get(studentId);

  // Get pending money given
  const moneyResult = db.db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM money_given_records
    WHERE student_id = ? AND status = 'PENDING'
  `).get(studentId);

  // Update totals to include pending items
  const finalTotalDue = totalDue + toNum(finesResult?.total) + toNum(damagesResult?.total) + toNum(moneyResult?.total);
  const finalTotalRemaining = Math.max(0, totalDue - totalPaid) + toNum(finesResult?.total) + toNum(damagesResult?.total) + toNum(moneyResult?.total);

  return {
    student,
    fees: processedFees,
    payments,
    summary: {
      total_due: finalTotalDue,
      total_paid: totalPaid,
      total_remaining: finalTotalRemaining,
      advance_balance: toNum(advanceResult?.total),
      pending_fines: toNum(finesResult?.total),
      pending_damages: toNum(damagesResult?.total),
      pending_money_given: toNum(moneyResult?.total)
    }
  };
};

module.exports = exports;