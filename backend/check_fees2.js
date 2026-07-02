const Database = require('better-sqlite3');
const db = new Database('./data/hostel.db');

// Get the full SQL for student_fees table
const result = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='student_fees'").get();
console.log('SCHEMA:');
console.log(result.sql);

// Check fees with various statuses 
const statuses = db.prepare("SELECT DISTINCT fee_status FROM student_fees").all();
console.log('\nFEE STATUSES:', JSON.stringify(statuses));

// Check which student IDs have fees
const studentFees = db.prepare("SELECT student_id, COUNT(*) as cnt FROM student_fees GROUP BY student_id").all();
console.log('\nSTUDENT FEES:', JSON.stringify(studentFees));

// Check recent student_fees
const recentFees = db.prepare("SELECT fee_id, student_id, fee_type, fee_status, fee_amount, final_amount FROM student_fees ORDER BY fee_id DESC LIMIT 10").all();
console.log('\nRECENT FEES:');
recentFees.forEach(f => console.log(`  ID=${f.fee_id} student=${f.student_id} type=${f.fee_type} status=${f.fee_status} amt=${f.fee_amount} final=${f.final_amount}`));

db.close();
