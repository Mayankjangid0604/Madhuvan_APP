// Full test: Create a half-yearly student and simulate 7 months of fee generation
// to verify the bug is fixed

const feeService = require('./src/services/fee.service');
const db = require('./src/config/db.sqlite');

console.log('\n=== HALF-YEARLY FEE BUG FIX TEST ===\n');

// Step 1: Create a test half-yearly student
const now = new Date();
const joiningDate = `${now.getFullYear()}-01-01`; // Joined Jan 1 this year

const studentResult = db.db.prepare(`
  INSERT INTO students (
    student_name, father_name, student_mobile, date_of_joining,
    monthly_fee, security_deposit, fee_type_cycle, fee_start_month, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
`).run('HalfYearly Test Student', 'Test Father', '9999000001', joiningDate, 12000, 5000, 'half_yearly', joiningDate);

const testStudentId = studentResult.lastInsertRowid;
console.log(`✅ Created test student ID: ${testStudentId} (half_yearly, joined ${joiningDate})`);

// Step 2: Create initial fee (simulating admission - Jan)
const initialFeeResult = feeService.createInitialFeesForStudent({
  student_id: testStudentId,
  monthly_fee: 12000,
  security_deposit: 5000,
  fee_start_date: joiningDate,
  fee_type_cycle: 'half_yearly'
}, false);

console.log(`✅ Initial fee created: main_fee_id=${initialFeeResult.main_fee_id}`);

// Show initial fee period
const initialFee = db.db.prepare('SELECT fee_month, fee_period_start, fee_period_end, fee_type FROM student_fees WHERE fee_id = ?').get(initialFeeResult.main_fee_id);
console.log(`   Type: ${initialFee.fee_type}`);
console.log(`   Period: ${initialFee.fee_period_start} → ${initialFee.fee_period_end}`);

console.log('\n--- Simulating monthly cron runs (Feb through Aug) ---');

// Step 3: Simulate 7 months of cron running (months 2 through 8)
for (let i = 1; i <= 8; i++) {
  const targetDate = new Date(now.getFullYear(), 0 + i, 1); // Feb, Mar, Apr...
  const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`;
  const monthName = targetDate.toLocaleString('en', { month: 'long', year: 'numeric' });
  
  const result = feeService.createMonthlyFee(testStudentId, targetMonthStr);
  
  if (result.success) {
    // Check what was created
    const fee = db.db.prepare('SELECT fee_type, fee_period_start, fee_period_end FROM student_fees WHERE fee_id = ?').get(result.fee_id);
    console.log(`  Month ${i} (${monthName}): ❌ BUG! Fee created! Type=${fee?.fee_type}, Period: ${fee?.fee_period_start} → ${fee?.fee_period_end}`);
  } else {
    const expected = (i === 6) ? 'SHOULD generate (6 months later)' : 'should NOT generate';
    const icon = (i === 6) ? '⚠️ CHECK: Not generated at month 6!' : '✅ CORRECT';
    console.log(`  Month ${i} (${monthName}): ${icon} → ${result.message}`);
  }
}

// Final check: count rent fees for this student
const allFees = db.db.prepare(
  "SELECT fee_month, fee_type, fee_period_start, fee_period_end FROM student_fees WHERE student_id = ? AND fee_type IN ('Half-Yearly Rent','Monthly Rent','Yearly Rent') ORDER BY fee_month"
).all(testStudentId);

console.log(`\n--- Final: ${allFees.length} rent fee(s) in DB (should be exactly 2 - Jan and Jul) ---`);
allFees.forEach(f => {
  console.log(`  ${f.fee_month}: ${f.fee_type} | ${f.fee_period_start} → ${f.fee_period_end}`);
});

if (allFees.length === 2) {
  console.log('\n✅ FIX VERIFIED: Exactly 2 fees generated (correct for half-yearly: Jan + Jul)');
} else if (allFees.length === 1) {
  console.log('\n⚠️  Only initial fee. 6-month cycle fee not triggered in this test window.');
} else {
  console.log(`\n❌ BUG STILL PRESENT: ${allFees.length} fees found (should be 1-2)`);
}

// Cleanup test student
db.db.prepare('DELETE FROM student_fees WHERE student_id = ?').run(testStudentId);
db.db.prepare('DELETE FROM students WHERE student_id = ?').run(testStudentId);
console.log('\n🧹 Test data cleaned up');
console.log('\n=== TEST COMPLETE ===');
process.exit(0);
