const communicationService = require("../services/communication.service");
const providerSchemas = require("../providers/providerSchemas");

const CHANNELS = ["email", "sms", "whatsapp"];

const assertChannel = (channel) => {
  if (!CHANNELS.includes(channel)) {
    const err = new Error(`Unknown channel: ${channel}`);
    err.status = 400;
    throw err;
  }
};

exports.getProviderCatalog = (req, res) => {
  res.json({ success: true, data: providerSchemas });
};

exports.getConfig = async (req, res, next) => {
  try {
    const { channel } = req.params;
    assertChannel(channel);
    const data = await communicationService.getSafeConfig(channel);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.saveProviderConfig = async (req, res, next) => {
  try {
    const { channel, provider } = req.params;
    assertChannel(channel);
    const data = await communicationService.saveProviderConfig(channel, provider, req.body || {});
    res.json({ success: true, message: `${provider} configuration saved`, data });
  } catch (error) {
    error.status = error.status || 400;
    next(error);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const { channel, provider } = req.params;
    assertChannel(channel);
    const result = await communicationService.testConnection(channel, provider, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    error.status = error.status || 400;
    next(error);
  }
};

exports.setActiveProvider = async (req, res, next) => {
  try {
    const { channel } = req.params;
    assertChannel(channel);
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ success: false, message: "provider is required" });
    const data = await communicationService.setActiveProvider(channel, provider);
    res.json({ success: true, message: `${provider} is now the active ${channel} provider`, data });
  } catch (error) {
    error.status = error.status || 400;
    next(error);
  }
};

exports.deactivateChannel = async (req, res, next) => {
  try {
    const { channel } = req.params;
    assertChannel(channel);
    const data = await communicationService.deactivateChannel(channel);
    res.json({ success: true, message: `${channel} disabled`, data });
  } catch (error) {
    next(error);
  }
};

exports.testSendEmail = async (req, res, next) => {
  try {
    const { to, subject, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, message: "Recipient email and message are required" });
    }
    const result = await communicationService.sendEmail({
      to,
      subject: subject || "Test Email",
      html: String(message).replace(/\n/g, "<br>"),
      sentBy: req.admin?.email || "admin"
    });
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
};

exports.testSendSms = async (req, res, next) => {
  try {
    const { mobile, message } = req.body;
    if (!mobile || !message) {
      return res.status(400).json({ success: false, message: "Mobile number and message are required" });
    }
    const result = await communicationService.sendSms({ mobile, message, sentBy: req.admin?.email || "admin" });
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
};

exports.testSendWhatsapp = async (req, res, next) => {
  try {
    const { mobile, message } = req.body;
    if (!mobile || !message) {
      return res.status(400).json({ success: false, message: "Mobile number and message are required" });
    }
    const result = await communicationService.sendWhatsapp({ mobile, message, sentBy: req.admin?.email || "admin" });
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getLogs = async (req, res, next) => {
  try {
    const data = communicationService.getLogs(req.query);
    res.json({ success: true, data: data.rows, total: data.total, limit: data.limit, offset: data.offset });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
