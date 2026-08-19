const auditService = require("../services/audit.service");
// TODO: Migrate to standardized responses:
// const { success, error } = require('../utils/response.util');

exports.getAuditLogs = (req, res) => {
  try {
    const logs = auditService.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = exports;
