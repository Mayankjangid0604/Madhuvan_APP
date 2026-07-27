const settingsService = require("../services/settings.service");
const path = require("path");
const fs = require("fs");

/**
 * GET HOSTEL INFO
 */
exports.getHostelInfo = async (req, res, next) => {
  try {
    const data = await settingsService.getHostelInfo();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Get hostel info error:", error);
    next(error);
  }
};

/**
 * SAVE HOSTEL INFO (with logo upload)
 */
exports.saveHostelInfo = async (req, res, next) => {
  try {
    // Merge with existing info to preserve logo paths when not re-uploaded
    const existingInfo = await settingsService.getHostelInfo() || {};
    const data = { ...existingInfo, ...req.body };

    // Handle logo uploads
    if (req.files) {
      if (req.files.logo_left && req.files.logo_left[0]) {
        data.logo_left = `/uploads/logos/${req.files.logo_left[0].filename}`;
      }
      if (req.files.logo_right && req.files.logo_right[0]) {
        data.logo_right = `/uploads/logos/${req.files.logo_right[0].filename}`;
      }
    }

    await settingsService.saveHostelInfo(data);

    res.json({
      success: true,
      message: "Hostel information saved successfully",
      data
    });
  } catch (error) {
    console.error("Save hostel info error:", error);
    next(error);
  }
};

/**
 * GET RULES
 */
exports.getRules = async (req, res, next) => {
  try {
    const rules = await settingsService.getRules();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error("Get rules error:", error);
    next(error);
  }
};

/**
 * SAVE RULES
 */
exports.saveRules = async (req, res, next) => {
  try {
    await settingsService.saveRules(req.body.rules || req.body);
    res.json({
      success: true,
      message: "Rules saved successfully"
    });
  } catch (error) {
    console.error("Save rules error:", error);
    next(error);
  }
};

/**
 * GET TEMPLATES
 */
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await settingsService.getTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error("Get templates error:", error);
    next(error);
  }
};

/**
 * SAVE TEMPLATE (generic - kind is one of: admission_email, admission_sms,
 * due_reminder_email, overdue_email, receipt_email, receipt_sms)
 */
exports.saveTemplate = async (req, res, next) => {
  try {
    const { kind } = req.params;
    await settingsService.saveTemplate(kind, req.body);
    res.json({ success: true, message: `${kind} template saved successfully` });
  } catch (error) {
    console.error("Save template error:", error);
    next(error);
  }
};

exports.getPhonePeConfig = async (req, res, next) => {
  try {
    const cfg = await settingsService.getConfig("phonepe_config", {
      enabled: false,
      merchant_id: "",
      salt_key: "",
      salt_index: "1",
      environment: "SANDBOX",
      callback_url: "",
    });
    res.json({ success: true, data: cfg });
  } catch (error) { next(error); }
};

exports.savePhonePeConfig = async (req, res, next) => {
  try {
    await settingsService.saveConfig("phonepe_config", req.body);
    res.json({ success: true, message: "PhonePe configuration saved" });
  } catch (error) { next(error); }
};

/**
 * GET/SAVE PUBLIC BASE URL (used to build the WhatsApp receipt document link)
 */
exports.getPublicBaseUrl = async (req, res, next) => {
  try {
    const publicBaseUrl = await settingsService.getConfig("communication_public_base_url", "");
    res.json({ success: true, data: { publicBaseUrl } });
  } catch (error) { next(error); }
};

exports.savePublicBaseUrl = async (req, res, next) => {
  try {
    await settingsService.saveConfig("communication_public_base_url", req.body.publicBaseUrl || "");
    res.json({ success: true, message: "Public base URL saved" });
  } catch (error) { next(error); }
};

/**
 * GET DRIVE CONFIG
 */
exports.getDriveConfig = async (req, res, next) => {
  try {
    const config = await settingsService.getDriveConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error("Get drive config error:", error);
    next(error);
  }
};

/**
 * SAVE DRIVE CONFIG
 */
exports.saveDriveConfig = async (req, res, next) => {
  try {
    await settingsService.saveDriveConfig(req.body);
    res.json({
      success: true,
      message: "Drive configuration saved successfully"
    });
  } catch (error) {
    console.error("Save drive config error:", error);
    next(error);
  }
};

/**
 * GET PENALTY CONFIG
 */
exports.getPenaltyConfig = async (req, res, next) => {
  try {
    const config = await settingsService.getPenaltyConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error("Get penalty config error:", error);
    next(error);
  }
};

/**
 * SAVE PENALTY CONFIG
 */
exports.savePenaltyConfig = async (req, res, next) => {
  try {
    await settingsService.savePenaltyConfig(req.body);
    res.json({
      success: true,
      message: "Penalty configuration saved successfully"
    });
  } catch (error) {
    console.error("Save penalty config error:", error);
    next(error);
  }
};

/**
 * UPLOAD LOGO (standalone endpoint)
 */
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No logo file provided"
      });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    res.json({
      success: true,
      message: "Logo uploaded successfully",
      data: { logo_url: logoUrl }
    });
  } catch (error) {
    console.error("Upload logo error:", error);
    next(error);
  }
};

module.exports = exports;