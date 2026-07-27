const express = require("express");
const router = express.Router();
const notificationService = require("../services/notification.service");
const auth = require("../middlewares/auth.middleware");

router.use(auth);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Fee reminder management (see /api/communication for provider config and test sends)
 */

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

module.exports = router;
