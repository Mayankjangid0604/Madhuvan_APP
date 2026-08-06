const db = require("../config/db.sqlite");
const path = require("path");
const fs = require("fs");

const { UPLOADS_DIR, LOGOS_UPLOAD_DIR, STUDENTS_UPLOAD_DIR } = require("../config/paths");

// =========================
// Cache Configuration
// =========================
let SETTINGS_CACHE = null;
let SETTINGS_CACHE_TIME = 0;
const SETTINGS_TTL = 3000;

let GENERIC_CACHE = {};
let GENERIC_CACHE_TIME = {};

// =========================
// Generic Cache Helper
// =========================
const getCached = async (key, loader, ttl = 3000) => {
  const now = Date.now();
  if (GENERIC_CACHE[key] && now - (GENERIC_CACHE_TIME[key] || 0) < ttl) {
    return GENERIC_CACHE[key];
  }
  const value = await loader();
  GENERIC_CACHE[key] = value;
  GENERIC_CACHE_TIME[key] = now;
  return value;
};

// =========================
// Helper Functions
// =========================
const getSetting = async (key, defaultValue = null) => {
  try {
    const [rows] = await db.query(
      "SELECT setting_value FROM settings WHERE setting_key = ?",
      [key]
    );

    if (!rows || rows.length === 0) return defaultValue;

    try {
      return JSON.parse(rows[0].setting_value);
    } catch {
      return rows[0].setting_value;
    }
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error.message);
    return defaultValue;
  }
};

const setSetting = async (key, value) => {
  const jsonValue = typeof value === "object" ? JSON.stringify(value) : String(value);

  try {
    const [existing] = await db.query(
      "SELECT id FROM settings WHERE setting_key = ?",
      [key]
    );

    if (existing && existing.length > 0) {
      await db.query(
        `UPDATE settings
         SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = ?`,
        [jsonValue, key]
      );
    } else {
      await db.query(
        `INSERT INTO settings (setting_key, setting_value)
         VALUES (?, ?)`,
        [key, jsonValue]
      );
    }
    
    clearCache();
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error.message);
    throw error;
  }
};

// =========================
// Templates
// =========================
exports.getTemplates = () =>
  getCached("templates", async () => {
    const admission_email = await getSetting("admission_email_template", {
      subject: "Admission Confirmed - {student_name}",
      body: `Dear {contact_name},

{student_name}'s admission to {hostel_name} is confirmed.

Please find attached the admission form and the fee invoice.

Amount Due: ₹{fee_amount}
Due Date: {due_date}

Thank you,
{hostel_name}`
    });
    const admission_sms = await getSetting("admission_sms_template", {
      message: "Dear {contact_name}, admission of {student_name} at {hostel_name} is confirmed. Fee Rs.{fee_amount} due on {due_date}. - {hostel_name}"
    });
    const due_reminder_email = await getSetting("due_reminder_email_template", {
      subject: "Fee Due Reminder - {student_name}",
      body: `Dear {contact_name},

This is a reminder that the hostel fee for {student_name} is due.

Amount: ₹{fee_amount}
Due Date: {due_date}

Please make the payment at the earliest.

Thank you,
{hostel_name}`
    });
    const overdue_email = await getSetting("overdue_email_template", {
      subject: "Fee Overdue - Updated Invoice - {student_name}",
      body: `Dear {contact_name},

The hostel fee for {student_name} is overdue. A late-payment penalty of ₹{penalty_amount} has been added.

Total Payable: ₹{fee_amount}
Original Due Date: {due_date}

Please find the updated invoice attached.

Thank you,
{hostel_name}`
    });
    const receipt_email = await getSetting("receipt_email_template", {
      subject: "Fee Receipt #{receipt_number} - {student_name}",
      body: `Dear {contact_name},

We have received ₹{fee_amount} for {student_name} on {payment_date}.

Receipt Number: {receipt_number}

Receipt attached.

Thank you,
{hostel_name}`
    });
    const receipt_sms = await getSetting("receipt_sms_template", {
      message: "Dear {contact_name}, payment of Rs.{fee_amount} received for {student_name} on {payment_date}. Receipt: {receipt_number}. - {hostel_name}"
    });
    return { admission_email, admission_sms, due_reminder_email, overdue_email, receipt_email, receipt_sms };
  });

exports.saveTemplate = (kind, data) => setSetting(`${kind}_template`, data);
exports.getConfig = (key, def) => getSetting(key, def);
exports.saveConfig = (key, data) => setSetting(key, data);

// =========================
// Communication Provider Config (Email / SMS / WhatsApp)
// Each channel stores { activeProvider, providers: { <key>: {...fields, enabled,
// lastTestedAt, lastTestStatus, lastTestMessage} } }. Secret fields (per
// providerSchemas.js) are encrypted at rest and only ever leave this module
// decrypted via getChannelConfig (internal/server-side use).
// =========================
const cryptoUtil = require("../utils/crypto.util");
const providerSchemas = require("../providers/providerSchemas");

const defaultProviderState = () => ({
  enabled: false,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestMessage: null
});

const emptyChannelConfig = (channel) => {
  const providers = {};
  Object.keys(providerSchemas[channel]).forEach((key) => {
    providers[key] = defaultProviderState();
  });
  return { activeProvider: null, providers };
};

const encryptProviderSecrets = (channel, providerKey, data) => {
  const schema = providerSchemas[channel]?.[providerKey];
  if (!schema) return data;
  const out = { ...data };
  schema.secretFields.forEach((f) => {
    if (out[f] !== undefined) out[f] = cryptoUtil.encrypt(out[f]);
  });
  return out;
};

const decryptProviderSecrets = (channel, providerKey, data) => {
  const schema = providerSchemas[channel]?.[providerKey];
  if (!schema || !data) return data;
  const out = { ...data };
  schema.secretFields.forEach((f) => {
    if (out[f] !== undefined) out[f] = cryptoUtil.decrypt(out[f]);
  });
  return out;
};

const maskProviderSecrets = (channel, providerKey, data) => {
  const schema = providerSchemas[channel]?.[providerKey];
  if (!schema || !data) return data;
  const out = { ...data };
  schema.secretFields.forEach((f) => {
    out[f] = out[f] ? "********" : "";
  });
  return out;
};

// One-time best-effort migration from the old single msg91_config blob
// (pre-multi-provider) into the new per-channel msg91 provider slot. Seeds
// field values only - the provider still has to pass Test Connection before
// it can be activated again under the new rules.
const seedFromLegacyMsg91Config = async (channel, providers) => {
  if (providers.msg91 && providers.msg91.authKey) return providers; // already migrated
  const legacy = await getSetting("msg91_config", null);
  if (!legacy || !legacy.authKey) return providers;

  const seeded = { ...defaultProviderState(), authKey: legacy.authKey };
  if (channel === "email") {
    seeded.domain = legacy.email?.domain || "";
    seeded.fromEmail = legacy.email?.fromEmail || "";
    seeded.fromName = legacy.email?.fromName || "Hostel Management";
  } else if (channel === "sms") {
    seeded.senderId = legacy.sms?.senderId || "";
    seeded.templateId = legacy.sms?.templates?.admission || "";
  } else if (channel === "whatsapp") {
    seeded.integratedNumber = legacy.whatsapp?.integratedNumber || "";
    seeded.namespace = legacy.whatsapp?.namespace || "";
    seeded.templateName = legacy.whatsapp?.templates?.receipt || "";
  }
  return { ...providers, msg91: seeded };
};

/**
 * Internal/server-side use only - returns decrypted secrets. Never send this
 * straight to the frontend; use getSafeChannelConfig for that.
 */
exports.getChannelConfig = async (channel) => {
  if (!providerSchemas[channel]) throw new Error(`Unknown channel: ${channel}`);
  const key = `${channel}_provider_config`;
  const stored = (await getSetting(key, null)) || emptyChannelConfig(channel);
  let providers = { ...emptyChannelConfig(channel).providers, ...stored.providers };
  providers = await seedFromLegacyMsg91Config(channel, providers);

  const decrypted = {};
  Object.keys(providers).forEach((pk) => {
    decrypted[pk] = decryptProviderSecrets(channel, pk, providers[pk]);
  });
  return { activeProvider: stored.activeProvider || null, providers: decrypted };
};

/** Frontend-safe version - secret fields are masked, never the real values. */
exports.getSafeChannelConfig = async (channel) => {
  const cfg = await exports.getChannelConfig(channel);
  const providers = {};
  Object.keys(cfg.providers).forEach((pk) => {
    providers[pk] = maskProviderSecrets(channel, pk, cfg.providers[pk]);
  });
  return { activeProvider: cfg.activeProvider, providers };
};

exports.saveProviderConfig = async (channel, providerKey, data) => {
  const schema = providerSchemas[channel]?.[providerKey];
  if (!schema) throw new Error(`Unknown ${channel} provider: ${providerKey}`);

  const key = `${channel}_provider_config`;
  const stored = (await getSetting(key, null)) || emptyChannelConfig(channel);
  stored.providers = stored.providers || {};
  const existing = stored.providers[providerKey] || defaultProviderState();

  const merged = { ...existing, ...data };
  let credentialsChanged = false;
  schema.secretFields.forEach((f) => {
    if (data[f] === "********" || data[f] === undefined) {
      merged[f] = existing[f]; // keep the existing encrypted value untouched
    } else if (data[f] !== cryptoUtil.decrypt(existing[f] || "")) {
      credentialsChanged = true;
    }
  });
  schema.requiredFields.forEach((f) => {
    if (!schema.secretFields.includes(f) && data[f] !== undefined && data[f] !== existing[f]) {
      credentialsChanged = true;
    }
  });

  if (credentialsChanged) {
    merged.lastTestedAt = null;
    merged.lastTestStatus = null;
    merged.lastTestMessage = null;
    merged.enabled = false;
  }

  stored.providers[providerKey] = encryptProviderSecrets(channel, providerKey, merged);
  await setSetting(key, stored);
  return exports.getSafeChannelConfig(channel);
};

exports.recordProviderTest = async (channel, providerKey, result) => {
  const key = `${channel}_provider_config`;
  const stored = (await getSetting(key, null)) || emptyChannelConfig(channel);
  stored.providers = stored.providers || {};
  const existing = stored.providers[providerKey] || defaultProviderState();
  stored.providers[providerKey] = {
    ...existing,
    lastTestedAt: new Date().toISOString(),
    lastTestStatus: result.success ? "success" : "failed",
    lastTestMessage: (result.message || result.error || "").slice(0, 500)
  };
  await setSetting(key, stored);
  return exports.getSafeChannelConfig(channel);
};

/**
 * Only one provider may be active per channel. Activation is refused unless
 * the provider's last Test Connection succeeded.
 */
exports.setActiveProvider = async (channel, providerKey) => {
  if (!providerSchemas[channel]?.[providerKey]) throw new Error(`Unknown ${channel} provider: ${providerKey}`);

  const key = `${channel}_provider_config`;
  const stored = (await getSetting(key, null)) || emptyChannelConfig(channel);
  stored.providers = stored.providers || {};
  const target = stored.providers[providerKey];

  if (!target || target.lastTestStatus !== "success") {
    throw new Error("This provider must pass Test Connection successfully before it can be activated");
  }

  Object.keys(stored.providers).forEach((pk) => {
    stored.providers[pk].enabled = pk === providerKey;
  });
  stored.activeProvider = providerKey;
  await setSetting(key, stored);
  return exports.getSafeChannelConfig(channel);
};

exports.deactivateChannel = async (channel) => {
  const key = `${channel}_provider_config`;
  const stored = (await getSetting(key, null)) || emptyChannelConfig(channel);
  stored.activeProvider = null;
  Object.keys(stored.providers || {}).forEach((pk) => { stored.providers[pk].enabled = false; });
  await setSetting(key, stored);
  return exports.getSafeChannelConfig(channel);
};

// =========================
// Drive Config
// =========================
exports.getDriveConfig = () =>
  getSetting("drive_config", {
    enabled: false,
    provider: "local",
    folder_path: "",
    credentials: null,
    autoBackup: true,
    backupSchedule: "monthly"
  });

exports.saveDriveConfig = (data) => setSetting("drive_config", data);

// =========================
// Hostel Rules
// =========================
exports.getRules = async () => {
  const rules = await getSetting("hostel_rules", []);
  return Array.isArray(rules) ? rules : [];
};

exports.saveRules = (data) => {
  const rules = Array.isArray(data) ? data : [];
  return setSetting("hostel_rules", rules);
};

// =========================
// Penalty Config
// =========================
exports.getPenaltyConfig = () =>
  getCached("penalty_config", async () =>
    getSetting("penalty_config", {
      enabled: false,
      grace_days: 5,
      penalty_amount: 50,
      penalty_type: "fixed",
      penalty_percentage: 5,
      recurring: false,
      recurring_days: 7,
      max_penalty: 500,
      include_in_email: true
    })
  );

exports.savePenaltyConfig = (data) => setSetting("penalty_config", data);

// =========================
// Hostel Info
// =========================
exports.getHostelInfo = async () => {
  const now = Date.now();
  if (SETTINGS_CACHE?.hostel && now - SETTINGS_CACHE_TIME < SETTINGS_TTL) {
    return SETTINGS_CACHE.hostel;
  }

  try {
    const [rows] = await db.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'hostel_info'"
    );
    const hostel = rows && rows[0] ? JSON.parse(rows[0].setting_value) : {};
    SETTINGS_CACHE = SETTINGS_CACHE || {};
    SETTINGS_CACHE.hostel = hostel;
    SETTINGS_CACHE_TIME = now;
    return hostel;
  } catch (error) {
    console.error("Error getting hostel info:", error.message);
    return {};
  }
};

exports.saveHostelInfo = async (data) => {
  return await setSetting("hostel_info", data);
};

// =========================
// Add Logos to PDF Documents
// =========================
exports.addHostelLogosToDoc = (doc, hostelInfo = {}) => {
  try {
    if (hostelInfo.logo_left && typeof hostelInfo.logo_left === "string" && hostelInfo.logo_left.trim()) {
      const leftPath = path.join(
        UPLOADS_DIR,
        hostelInfo.logo_left.replace("/uploads/", "")
      );

      console.log("📁 Looking for left logo:", leftPath);
      if (fs.existsSync(leftPath)) {
        doc.image(leftPath, 40, 30, { width: 60 });
      } else {
        console.warn("⚠️ Left logo not found:", leftPath);
      }
    }

    if (hostelInfo.logo_right && typeof hostelInfo.logo_right === "string" && hostelInfo.logo_right.trim()) {
      const rightPath = path.join(
        UPLOADS_DIR,
        hostelInfo.logo_right.replace("/uploads/", "")
      );

      console.log("📁 Looking for right logo:", rightPath);
      if (fs.existsSync(rightPath)) {
        doc.image(rightPath, 480, 30, { width: 60 });
      } else {
        console.warn("⚠️ Right logo not found:", rightPath);
      }
    }
  } catch (err) {
    console.warn("⚠️ Logo load skipped:", err.message);
  }
};

// =========================
// Cache Management
// =========================
const clearCache = () => {
  SETTINGS_CACHE = null;
  SETTINGS_CACHE_TIME = 0;
  GENERIC_CACHE = {};
  GENERIC_CACHE_TIME = {};
};

exports.clearCache = clearCache;

exports.getSetting = getSetting;
exports.saveSetting = setSetting;