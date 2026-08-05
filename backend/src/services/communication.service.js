/**
 * Central orchestrator for all outbound communication. Business logic
 * (notification.service.js) only ever calls sendEmail/sendSms/sendWhatsapp*
 * here - it never talks to a specific provider directly, so switching the
 * active provider in Settings requires no code changes anywhere else.
 */
const db = require('../config/db.sqlite');
const settingsService = require('./settings.service');
const emailProviders = require('../providers/email');
const smsProviders = require('../providers/sms');
const whatsappProviders = require('../providers/whatsapp');

const FACTORIES = { email: emailProviders, sms: smsProviders, whatsapp: whatsappProviders };

const logCommunication = ({ channel, provider, recipient, subject, message, status, error, providerResponse, sentBy, studentId }) => {
  try {
    db.db.prepare(`
      INSERT INTO communication_logs
        (channel, provider, recipient, subject, message, status, error, provider_response, sent_by, student_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      channel, provider || null, recipient || null, subject || null, message ? String(message).slice(0, 2000) : null,
      status, error ? String(error).slice(0, 1000) : null,
      providerResponse ? JSON.stringify(providerResponse).slice(0, 4000) : null,
      sentBy || 'system', studentId || null
    );
  } catch (e) {
    console.warn('Failed to write communication log:', e.message);
  }
};

// =========================
// Config management (delegates to settingsService, which owns encryption)
// =========================
exports.getSafeConfig = (channel) => settingsService.getSafeChannelConfig(channel);

exports.saveProviderConfig = (channel, providerKey, data) => settingsService.saveProviderConfig(channel, providerKey, data);

exports.setActiveProvider = (channel, providerKey) => settingsService.setActiveProvider(channel, providerKey);

exports.deactivateChannel = (channel) => settingsService.deactivateChannel(channel);

exports.testConnection = async (channel, providerKey, overrideConfig) => {
  const factory = FACTORIES[channel];
  if (!factory) throw new Error(`Unknown channel: ${channel}`);
  const providerModule = factory.getProvider(providerKey);

  const current = await settingsService.getChannelConfig(channel);
  const existing = current.providers[providerKey] || {};

  let config = existing;
  if (overrideConfig) {
    config = { ...existing, ...overrideConfig };
    // Masked placeholders from the frontend mean "keep the saved secret"
    Object.keys(overrideConfig).forEach((k) => {
      if (overrideConfig[k] === '********') config[k] = existing[k];
    });
  }

  const result = await providerModule.testConnection(config);
  await settingsService.recordProviderTest(channel, providerKey, result);
  return result;
};

const resolveActive = async (channel) => {
  const cfg = await settingsService.getChannelConfig(channel);
  if (!cfg.activeProvider) return null;
  const providerConfig = cfg.providers[cfg.activeProvider];
  if (!providerConfig || !providerConfig.enabled) return null;
  return { key: cfg.activeProvider, config: providerConfig, module: FACTORIES[channel].getProvider(cfg.activeProvider) };
};

// =========================
// Sending (the only surface business logic should use)
// =========================
exports.sendEmail = async ({ to, toName, subject, html, attachments = [], sentBy, studentId }) => {
  const active = await resolveActive('email');
  if (!active) {
    logCommunication({ channel: 'email', recipient: to, subject, status: 'failed', error: 'No active email provider configured', sentBy, studentId });
    return { success: false, reason: 'No active email provider configured' };
  }
  const result = await active.module.send(active.config, { to, toName, subject, html, attachments });
  logCommunication({
    channel: 'email', provider: active.key, recipient: to, subject, message: html,
    status: result.success ? 'success' : 'failed', error: result.error, providerResponse: result.providerResponse,
    sentBy, studentId
  });
  return { ...result, provider: active.key };
};

exports.sendSms = async ({ mobile, message, sentBy, studentId }) => {
  const active = await resolveActive('sms');
  if (!active) {
    logCommunication({ channel: 'sms', recipient: mobile, message, status: 'failed', error: 'No active SMS provider configured', sentBy, studentId });
    return { success: false, reason: 'No active SMS provider configured' };
  }
  const result = await active.module.send(active.config, { mobile, message });
  logCommunication({
    channel: 'sms', provider: active.key, recipient: mobile, message,
    status: result.success ? 'success' : 'failed', error: result.error, providerResponse: result.providerResponse,
    sentBy, studentId
  });
  return { ...result, provider: active.key };
};

exports.sendWhatsapp = async ({ mobile, message, sentBy, studentId }) => {
  const active = await resolveActive('whatsapp');
  if (!active) {
    logCommunication({ channel: 'whatsapp', recipient: mobile, message, status: 'failed', error: 'No active WhatsApp provider configured', sentBy, studentId });
    return { success: false, reason: 'No active WhatsApp provider configured' };
  }
  const result = await active.module.send(active.config, { mobile, message });
  logCommunication({
    channel: 'whatsapp', provider: active.key, recipient: mobile, message,
    status: result.success ? 'success' : 'failed', error: result.error, providerResponse: result.providerResponse,
    sentBy, studentId
  });
  return { ...result, provider: active.key };
};

/** Document/template WhatsApp send - used for fee receipts. */
exports.sendWhatsappDocument = async ({ mobile, documentUrl, filename, bodyParams = [], sentBy, studentId }) => {
  const active = await resolveActive('whatsapp');
  if (!active) {
    logCommunication({ channel: 'whatsapp', recipient: mobile, message: filename, status: 'failed', error: 'No active WhatsApp provider configured', sentBy, studentId });
    return { success: false, reason: 'No active WhatsApp provider configured' };
  }
  if (typeof active.module.sendDocument !== 'function') {
    logCommunication({ channel: 'whatsapp', provider: active.key, recipient: mobile, message: filename, status: 'failed', error: 'Provider does not support document messages', sentBy, studentId });
    return { success: false, reason: 'Provider does not support document messages' };
  }
  const result = await active.module.sendDocument(active.config, { mobile, documentUrl, filename, bodyParams });
  logCommunication({
    channel: 'whatsapp', provider: active.key, recipient: mobile, message: filename,
    status: result.success ? 'success' : 'failed', error: result.error, providerResponse: result.providerResponse,
    sentBy, studentId
  });
  return { ...result, provider: active.key };
};

// =========================
// Logs
// =========================
exports.getLogs = (filters = {}) => {
  const conditions = [];
  const params = [];
  if (filters.channel) { conditions.push('channel = ?'); params.push(filters.channel); }
  if (filters.provider) { conditions.push('provider = ?'); params.push(filters.provider); }
  if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
  if (filters.from_date) { conditions.push('date(created_at) >= date(?)'); params.push(filters.from_date); }
  if (filters.to_date) { conditions.push('date(created_at) <= date(?)'); params.push(filters.to_date); }
  if (filters.recipient) { conditions.push('recipient LIKE ?'); params.push(`%${filters.recipient}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number(filters.limit) || 50, 500);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const rows = db.db.prepare(`SELECT * FROM communication_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.db.prepare(`SELECT COUNT(*) as c FROM communication_logs ${where}`).get(...params).c;
  return { rows, total, limit, offset };
};
