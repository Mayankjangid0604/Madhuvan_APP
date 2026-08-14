const vendorService = require("../services/vendor.service");
const asyncHandler = require("../utils/asyncHandler");
// TODO: Migrate to standardized responses:
// const { success, error } = require('../utils/response.util');
// e.g. return success(res, vendor, 'Vendor created', 201);
// e.g. return error(res, 'Vendor not found', 404);

exports.getAll = asyncHandler(async (req, res) => {
  const vendors = vendorService.getAll();
  res.json({ success: true, data: vendors });
});

exports.getById = asyncHandler(async (req, res) => {
  const vendor = vendorService.getById(req.params.id);
  if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
  res.json({ success: true, data: vendor });
});

exports.create = asyncHandler(async (req, res) => {
  const vendor = vendorService.create(req.body);
  res.status(201).json({ success: true, data: vendor, message: "Vendor created" });
});

exports.update = asyncHandler(async (req, res) => {
  const vendor = vendorService.update(req.params.id, req.body);
  if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
  res.json({ success: true, data: vendor, message: "Vendor updated" });
});

exports.deactivate = asyncHandler(async (req, res) => {
  vendorService.deactivate(req.params.id);
  res.json({ success: true, message: "Vendor deleted" });
});

module.exports = exports;
