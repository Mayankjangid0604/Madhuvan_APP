const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// ============================================
// LOGIN RATE LIMITER (in-memory)
// ============================================
const loginAttempts = new Map();
const loginRateLimit = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < windowMs);
  if (recent.length >= maxAttempts) {
    return res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
};

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Admin authentication
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Admin login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 */
router.post("/login", loginRateLimit, authController.login);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change admin password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post("/change-password", authMiddleware, authController.changePassword);

/**
 * @route POST /api/auth/change-username
 * @desc Change admin username (email)
 */
router.post("/change-username", authMiddleware, authController.changeUsername);

/**
 * @route GET /api/auth/me
 * @desc Get current admin info
 */
router.get("/me", authMiddleware, authController.getCurrentAdmin);

module.exports = router;