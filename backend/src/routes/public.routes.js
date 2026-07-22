// Public, unauthenticated routes. Only signed-token access is allowed here -
// this exists so external services (MSG91 WhatsApp media fetch) can retrieve
// a specific PDF without an auth session.
const express = require("express");
const router = express.Router();
const fs = require("fs");
const invoiceService = require("../services/invoice.service");
const signedLink = require("../utils/signedLink.util");

router.get("/receipt/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { token } = req.query;

    if (!signedLink.verify(`receipt:${paymentId}`, token)) {
      return res.status(403).json({ success: false, message: "Invalid or expired link" });
    }

    const { filePath } = await invoiceService.generateReceiptForPayment(paymentId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="receipt_${paymentId}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
