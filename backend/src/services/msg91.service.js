/**
 * MSG91 integration - single provider for SMS, Email and WhatsApp.
 * Docs: https://docs.msg91.com/
 */
const settingsService = require("./settings.service");

const SMS_URL = "https://control.msg91.com/api/v5/flow/";
const EMAIL_URL = "https://api.msg91.com/api/v5/email/send";
const WHATSAPP_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const normalizeMobile = (mobile) => {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
};

const request = async (url, authKey, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok || data.type === "error") {
    throw new Error(data.message || `MSG91 request failed (${res.status})`);
  }
  return data;
};

/**
 * Send an SMS using an MSG91 Flow (DLT-registered template).
 * variables map to the {{VAR}} placeholders configured on the MSG91 flow.
 */
exports.sendSms = async ({ mobile, templateId, variables = {} }) => {
  const config = await settingsService.getMsg91Config();
  if (!config.enabled || !config.authKey) {
    return { success: false, reason: "MSG91 not configured" };
  }
  if (!templateId) {
    return { success: false, reason: "SMS template not configured" };
  }
  const to = normalizeMobile(mobile);
  if (!to) {
    return { success: false, reason: "No mobile number" };
  }

  try {
    await request(SMS_URL, config.authKey, {
      template_id: templateId,
      short_url: "0",
      recipients: [{ mobiles: to, ...variables }]
    });
    return { success: true, mobile: to };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send an email via MSG91's Email API, with optional PDF attachments.
 * attachments: [{ filename, path }]
 */
exports.sendEmail = async ({ to, toName, subject, html, attachments = [] }) => {
  const config = await settingsService.getMsg91Config();
  if (!config.enabled || !config.authKey) {
    return { success: false, reason: "MSG91 not configured" };
  }
  if (!to) {
    return { success: false, reason: "No email address" };
  }

  const fs = require("fs");
  const encodedAttachments = attachments
    .filter((a) => a && a.path && fs.existsSync(a.path))
    .map((a) => ({
      fileName: a.filename,
      content: fs.readFileSync(a.path).toString("base64")
    }));

  try {
    await request(EMAIL_URL, config.authKey, {
      recipients: [{ to: [{ name: toName || "", email: to }] }],
      from: {
        name: config.email?.fromName || "Hostel Management",
        email: config.email?.fromEmail
      },
      domain: config.email?.domain,
      subject,
      mail: { body: html },
      attachments: encodedAttachments
    });
    return { success: true, email: to };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send a WhatsApp document template message (used for fee receipts).
 * documentUrl must be a publicly reachable URL - WhatsApp fetches the media itself.
 */
exports.sendWhatsappDocument = async ({ mobile, documentUrl, filename, bodyParams = [] }) => {
  const config = await settingsService.getMsg91Config();
  if (!config.enabled || !config.authKey) {
    return { success: false, reason: "MSG91 not configured" };
  }
  const templateName = config.whatsapp?.templates?.receipt;
  if (!config.whatsapp?.integratedNumber || !templateName) {
    return { success: false, reason: "WhatsApp not configured" };
  }
  const to = normalizeMobile(mobile);
  if (!to) {
    return { success: false, reason: "No mobile number" };
  }

  const components = {
    header_1: { type: "document", value: documentUrl, filename }
  };
  bodyParams.forEach((value, idx) => {
    components[`body_${idx + 1}`] = { type: "text", value: String(value) };
  });

  try {
    await request(WHATSAPP_URL, config.authKey, {
      integrated_number: config.whatsapp.integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: { code: "en", policy: "deterministic" },
          namespace: config.whatsapp.namespace,
          to_and_components: [{ to: [to], components }]
        }
      }
    });
    return { success: true, mobile: to };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.normalizeMobile = normalizeMobile;
