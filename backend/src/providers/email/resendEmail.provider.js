const fs = require('fs');

/**
 * EmailProvider: Resend (https://resend.com) via REST API.
 * config: { apiKey, fromEmail, fromName }
 *
 * Uses the built-in fetch API (Node 18+). No external dependencies.
 * API reference: https://resend.com/docs/api-reference/emails/send-email
 */

const API_BASE = 'https://api.resend.com';

exports.testConnection = async (config) => {
  try {
    const res = await fetch(`${API_BASE}/api-keys`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    if (res.ok) {
      return { success: true, message: 'Resend API key is valid' };
    }
    const body = await res.json().catch(() => ({}));
    return { success: false, message: body.message || `API returned status ${res.status}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { to, toName, subject, html, attachments = [] }) => {
  const from = config.fromName
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail;

  const encodedAttachments = attachments
    .filter((a) => a && a.path && fs.existsSync(a.path))
    .map((a) => ({
      filename: a.filename,
      content: fs.readFileSync(a.path).toString('base64')
    }));

  const payload = {
    from,
    to: [to],
    subject,
    html
  };

  if (encodedAttachments.length > 0) {
    payload.attachments = encodedAttachments;
  }

  try {
    const res = await fetch(`${API_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      return { success: true, providerResponse: body };
    }
    return { success: false, error: body.message || `API returned status ${res.status}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
