const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { uploadLogo } = require('../middlewares/upload.middleware');
const authMiddleware = require('../middlewares/auth.middleware');

// Apply auth middleware to all settings routes
router.use(authMiddleware);

// =========================
// Hostel Information
// =========================
router.get('/hostel-info', settingsController.getHostelInfo);
router.post('/hostel-info', uploadLogo.fields([
  { name: 'logo_left', maxCount: 1 },
  { name: 'logo_right', maxCount: 1 }
]), settingsController.saveHostelInfo);

// =========================
// Hostel Rules
// =========================
router.get('/rules', settingsController.getRules);
router.post('/rules', settingsController.saveRules);

// =========================
// Templates
// =========================
router.get('/templates', settingsController.getTemplates);
router.post('/templates/:kind', settingsController.saveTemplate);

// =========================
// Public base URL (see /api/communication for provider config)
// =========================
router.get('/public-base-url', settingsController.getPublicBaseUrl);
router.post('/public-base-url', settingsController.savePublicBaseUrl);

// =========================
// Drive Config
// =========================
router.get('/drive-config', settingsController.getDriveConfig);
router.post('/drive-config', settingsController.saveDriveConfig);

// =========================
// Penalty Config
// =========================
router.get('/penalty-config', settingsController.getPenaltyConfig);
router.post('/penalty-config', settingsController.savePenaltyConfig);

// =========================
// PhonePe Gateway Config
// =========================
router.get('/phonepe-config', settingsController.getPhonePeConfig);
router.post('/phonepe-config', settingsController.savePhonePeConfig);

// =========================
// Logo Upload (standalone endpoint)
// =========================
router.post('/upload-logo', uploadLogo.single('logo'), settingsController.uploadLogo);

module.exports = router;