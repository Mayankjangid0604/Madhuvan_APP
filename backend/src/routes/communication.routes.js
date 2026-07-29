const express = require("express");
const router = express.Router();
const communicationController = require("../controllers/communication.controller");
const auth = require("../middlewares/auth.middleware");

router.use(auth);

// Provider catalog (which providers exist per channel, and their required fields)
router.get("/providers", communicationController.getProviderCatalog);

// Per-channel config (email | sms | whatsapp)
router.get("/config/:channel", communicationController.getConfig);
router.post("/config/:channel/:provider", communicationController.saveProviderConfig);
router.post("/config/:channel/:provider/test", communicationController.testConnection);
router.post("/active/:channel", communicationController.setActiveProvider);
router.post("/deactivate/:channel", communicationController.deactivateChannel);

// Test sends (real send through whichever provider is active for that channel)
router.post("/test-send/email", communicationController.testSendEmail);
router.post("/test-send/sms", communicationController.testSendSms);
router.post("/test-send/whatsapp", communicationController.testSendWhatsapp);

// Communication logs
router.get("/logs", communicationController.getLogs);

module.exports = router;
