const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/db.sqlite');
const settingsService = require('./settings.service');
const { RUNTIME_DIR } = require('../config/paths');

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

/**
 * Generate the admission form PDF for a student (attached to the admission email).
 */
async function generateAdmissionFormPDF(studentId) {
  const student = db.db.prepare(`
    SELECT s.*, r.room_no
    FROM students s
    LEFT JOIN room_allocation a ON a.student_id = s.student_id AND a.allocation_status = 'active'
    LEFT JOIN rooms r ON a.room_id = r.room_id
    WHERE s.student_id = ?
  `).get(studentId);
  if (!student) throw new Error('Student not found');

  const hostelInfo = await settingsService.getHostelInfo() || {};

  const appDir = RUNTIME_DIR;
  const dir = path.join(appDir, 'admission-forms');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `admission_${studentId}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(16).font('Helvetica-Bold')
    .text(hostelInfo?.hostel_name || 'HOSTEL', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('ADMISSION FORM', { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.7);

  const field = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(9).text(label, 40, doc.y, { continued: true });
    doc.font('Helvetica').text(`  ${value || 'N/A'}`);
  };

  field('Student Name:', student.student_name);
  field('Date of Birth:', formatDate(student.date_of_birth));
  field('Gender:', student.gender);
  field('Student Mobile:', student.student_mobile);
  field('Class / Coaching:', student.class_or_coaching);
  field('Institute Name:', student.institute_name);
  field('Date of Joining:', formatDate(student.date_of_joining));
  field('Room:', student.room_no);
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(10).text('Father Details', 40, doc.y);
  field('Name:', student.father_name);
  field('Mobile:', student.father_mobile);
  field('Email:', student.father_email);
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(10).text('Mother Details', 40, doc.y);
  field('Name:', student.mother_name);
  field('Mobile:', student.mother_mobile);
  field('Email:', student.mother_email);
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(10).text('Local Guardian Details', 40, doc.y);
  field('Name:', student.local_guardian_name);
  field('Relation:', student.local_guardian_relation);
  field('Mobile:', student.local_guardian_mobile);
  field('Email:', student.local_guardian_email);
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(10).text('Identification & Address', 40, doc.y);
  field('ID Type:', student.id_type);
  field('ID Number:', student.id_number);
  field('Address:', [student.address_line1, student.address_line2, student.address_line3].filter(Boolean).join(', '));
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(10).text('Fee Details', 40, doc.y);
  field('Monthly Fee:', student.monthly_fee != null ? `₹${student.monthly_fee}` : null);
  field('Security Deposit:', student.security_deposit != null ? `₹${student.security_deposit}` : null);
  doc.moveDown(1);

  doc.fontSize(8).font('Helvetica')
    .text(`Generated: ${formatDate(new Date())}`, 40, doc.y);
  doc.text('Authorized Signature: _______________', 380, doc.y - doc.currentLineHeight());

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return filePath;
}

module.exports = { generateAdmissionFormPDF };
