/**
 * Standardized API response helpers.
 *
 * Usage:
 *   const { success, error } = require('../utils/response.util');
 *   return success(res, data, 'Created', 201);
 *   return error(res, 'Not found', 404);
 */

const success = (res, data, message = 'Success', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

const error = (res, message = 'Error', status = 500) => {
  return res.status(status).json({ success: false, message });
};

module.exports = { success, error };
