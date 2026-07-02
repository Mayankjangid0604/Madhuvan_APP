const Database = require('better-sqlite3');
const db = new Database('./data/hostel.db');

// Add missing student columns
const studentCols = [
    'fee_type_cycle TEXT DEFAULT "monthly"',
    'next_fee_due_date DATE',
    'original_security_deposit REAL'
];
studentCols.forEach(col => {
    try {
        db.exec('ALTER TABLE students ADD COLUMN ' + col);
        console.log('Added student column: ' + col);
    } catch (e) {
        console.log('Skip student: ' + col.split(' ')[0] + ' (already exists)');
    }
});

// Add missing member columns
const memberCols = [
    'photo_url TEXT',
    'dob DATE',
    'id_type TEXT',
    'id_number TEXT',
    'salary REAL DEFAULT 0',
    'father_name TEXT',
    'date_of_joining DATE',
    'address TEXT',
    'fee_commission_percent REAL DEFAULT 0'
];
memberCols.forEach(col => {
    try {
        db.exec('ALTER TABLE members ADD COLUMN ' + col);
        console.log('Added member column: ' + col);
    } catch (e) {
        console.log('Skip member: ' + col.split(' ')[0] + ' (already exists)');
    }
});

// Add missing student_fees columns
const feeCols = [
    'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'discount_amount REAL DEFAULT 0',
    'final_amount REAL DEFAULT 0',
    'advance_used REAL DEFAULT 0',
    'advance_received REAL DEFAULT 0',
    'paid_via_advance INTEGER DEFAULT 0',
    'fine_adjustment_note TEXT'
];
feeCols.forEach(col => {
    try {
        db.exec('ALTER TABLE student_fees ADD COLUMN ' + col);
        console.log('Added fee column: ' + col);
    } catch (e) {
        console.log('Skip fee: ' + col.split(' ')[0] + ' (already exists)');
    }
});

// Verify
console.log('\n--- Verify Members ---');
const mCols = db.prepare('PRAGMA table_info(members)').all();
console.log('Members columns:', mCols.map(c => c.name).join(', '));

console.log('\n--- Verify Students ---');
const sCols = db.prepare('PRAGMA table_info(students)').all();
console.log('Students columns:', sCols.map(c => c.name).join(', '));

console.log('\n--- Verify Fees ---');
const fCols = db.prepare('PRAGMA table_info(student_fees)').all();
console.log('Fees columns:', fCols.map(c => c.name).join(', '));

console.log('\nDone - DB schema fixed!');
db.close();
