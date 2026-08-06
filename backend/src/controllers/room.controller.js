const { query, db } = require("../config/db.sqlite");

/**
 * GET AVAILABLE ROOMS WITH FREE BEDS
 */
exports.getAvailableRooms = (req, res) => {
  try {
    const [rows] = query(`
      SELECT
        r.room_id,
        r.room_no,
        r.room_type,
        r.floor_no,
        b.bed_id,
        b.bed_no
      FROM rooms r
      JOIN beds b ON b.room_id = r.room_id
      LEFT JOIN room_allocation ra
        ON ra.bed_id = b.bed_id
        AND ra.allocation_status = 'active'
      WHERE b.bed_status = 'available'
        AND (ra.allocation_status IS NULL OR ra.allocation_status != 'active')
      ORDER BY r.room_no, b.bed_no
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET AVAILABLE ROOMS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load available rooms"
    });
  }
};

/**
 * ALLOCATE ROOM
 */
exports.allocateRoom = (req, res) => {
  const student_id = Number(req.body.student_id);
  const room_id = Number(req.body.room_id);
  const bed_id = Number(req.body.bed_id);
  const allocation_start_date =
    req.body.allocation_start_date || new Date().toISOString().split("T")[0];

  if (!student_id || !room_id || !bed_id) {
    return res.status(400).json({
      success: false,
      message: "student_id, room_id and bed_id required"
    });
  }

  try {
    const allocationService = require("../services/allocation.service");
    const result = allocationService.allocateBed({ student_id, room_id, bed_id, allocation_start_date });
    res.json({ success: true, message: "Room allocated successfully", data: result });
  } catch (err) {
    const status = err.message.includes("not available") || err.message.includes("already has") ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = exports;
