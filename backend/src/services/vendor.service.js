const db = require("../config/db.sqlite");

exports.getAll = () => {
  return db.db.prepare("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name ASC").all();
};

exports.getById = (id) => {
  return db.db.prepare("SELECT * FROM vendors WHERE vendor_id = ?").get(id);
};

exports.create = ({ name, contact_person, mobile, email, address, gst_number }) => {
  if (!name) throw new Error("Vendor name is required");
  const result = db.db.prepare(
    "INSERT INTO vendors (name, contact_person, mobile, email, address, gst_number) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, contact_person || null, mobile || null, email || null, address || null, gst_number || null);
  return exports.getById(result.lastInsertRowid);
};

exports.update = (id, { name, contact_person, mobile, email, address, gst_number }) => {
  if (!name) throw new Error("Vendor name is required");
  db.db.prepare(
    "UPDATE vendors SET name = ?, contact_person = ?, mobile = ?, email = ?, address = ?, gst_number = ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?"
  ).run(name, contact_person || null, mobile || null, email || null, address || null, gst_number || null, id);
  return exports.getById(id);
};

exports.deactivate = (id) => {
  db.db.prepare("UPDATE vendors SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?").run(id);
};

module.exports = exports;
