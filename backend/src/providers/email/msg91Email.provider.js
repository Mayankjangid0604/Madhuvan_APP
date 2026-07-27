const fs = require('fs');

const EMAIL_URL = 'https://api.msg91.com/api/v5/email/send';

const request = async (config, body) => {
  const res = await fetch(EMAIL_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: config.authKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok || data.type === 'error') {
    throw new Error(data.message || `MSG91 email request failed (${res.status})`);
  }
  return data;
};

exports.testConnection = async (config) => {
  if (!config.authKey || !config.domain || !config.fromEmail) {
    return { success: false, message: 'Auth key, domain and from-email are required' };
  }
  try {
    // MSG91 has no dedicated "ping" endpoint - a dry-run send to a
    // known-invalid but well-formed address surfaces auth/domain errors
    // without actually delivering mail.
    await request(config, {
      recipients: [{ to: [{ name: 'Connection Test', email: 'connection-test@example.invalid' }] }],
      from: { name: config.fromName || 'Hostel Management', email: config.fromEmail },
      domain: config.domain,
      subject: 'Connection test',
      mail: { body: 'Connection test' }
    });
    return { success: true, message: 'MSG91 accepted the test request' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { to, subject, html, attachments = [] }) => {
  const encodedAttachments = attachments
    .filter((a) => a && a.path && fs.existsSync(a.path))
    .map((a) => ({ fileName: a.filename, content: fs.readFileSync(a.path).toString('base64') }));

  try {
    const data = await request(config, {
      recipients: [{ to: [{ name: '', email: to }] }],
      from: { name: config.fromName || 'Hostel Management', email: config.fromEmail },
      domain: config.domain,
      subject,
      mail: { body: html },
      attachments: encodedAttachments
    });
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
