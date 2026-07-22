const express = require("express");
const router = express.Router();
const notificationService = require("../services/notification.service");
const auth = require("../middlewares/auth.middleware");

// ✅ FIX: Add authentication middleware to all routes
router.use(auth);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Email and SMS notification management
 */

/**
 * @swagger
 * /api/notifications/test-email:
 *   post:
 *     summary: Send test email
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email address is required" 
      });
    }
    
    // ✅ FIX: Removed redundant require - already imported at top
    await notificationService.sendTestEmail(email);

    res.json({ 
      success: true,
      message: "Test email sent successfully"
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

/**
 * @swagger
 * /api/notifications/test-sms:
 *   post:
 *     summary: Send test SMS
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post("/test-sms", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "A valid phone number is required (e.g. +919999999999)"
      });
    }

    await notificationService.sendTestSMS(phone);

    res.json({
      success: true,
      message: "Test SMS sent successfully"
    });
  } catch (err) {
    // Differentiate config errors from send errors
    const isConfigError = err.message.includes("not configured") ||
                          err.message.includes("not found") ||
                          err.message.includes("configure");

    const statusCode = isConfigError ? 422 : 400;
    const message = isConfigError
      ? "SMS is not configured. Please set up your MSG91 Auth Key and SMS template in Settings → MSG91 Configuration first."
      : err.message;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

/**
 * @swagger
 * /api/notifications/send-due-reminder/{studentId}/{feeId}:
 *   post:
 *     summary: Manually (re)send a due-fee reminder email for a specific fee
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post("/send-due-reminder/:studentId/:feeId", async (req, res) => {
  try {
    const { studentId, feeId } = req.params;
    const result = await notificationService.sendDueReminderEmail(studentId, feeId, "manual");

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/send-overdue-reminder/{studentId}/{feeId}:
 *   post:
 *     summary: Manually (re)send an overdue-fee reminder email for a specific fee
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post("/send-overdue-reminder/:studentId/:feeId", async (req, res) => {
  try {
    const { studentId, feeId } = req.params;
    const result = await notificationService.sendOverdueReminderEmail(studentId, feeId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/reinitialize:
 *   post:
 *     summary: Reinitialize notification services after settings change
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post("/reinitialize", async (req, res) => {
  try {
    await notificationService.reinitialize();
    
    res.json({
      success: true,
      message: "Notification services reinitialized"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;