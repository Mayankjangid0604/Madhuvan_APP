const Database = require('better-sqlite3');
const db = new Database('./data/hostel.db');

// Check student_fees table schema
const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='student_fees'").all();
console.log('STUDENT_FEES SCHEMA:');
console.log(tables[0].sql);
console.log('');

// Check fees data
const fees = db.prepare("SELECT fee_id, student_id, fee_type, fee_status, fee_amount FROM student_fees LIMIT 10").all();
console.log('FEES DATA:');
fees.forEach(f => console.log(`  ID=${f.fee_id} student=${f.student_id} type=${f.fee_type} status=${f.fee_status} amt=${f.fee_amount}`));

db.close();
