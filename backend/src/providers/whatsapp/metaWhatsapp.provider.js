const { parseJsonResponse } = require('../httpJson.util');

const GRAPH_VERSION = 'v21.0';

const normalizeE164 = (mobile) => {
  if (!mobile) return null;
  let m = String(mobile).trim();
  if (!m.startsWith('+')) {
    const digits = m.replace(/\D/g, '').replace(/^0+/, '');
    m = digits.length === 10 ? `91${digits}` : digits;
  } else {
    m = m.slice(1);
  }
  return m;
};

const messagesUrl = (phoneNumberId) => `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

exports.testConnection = async (config) => {
  if (!config.phoneNumberId || !config.accessToken) {
    return { success: false, message: 'Phone Number ID and access token are required' };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}?fields=verified_name,display_phone_number`,
      { headers: { Authorization: `Bearer ${config.accessToken}` } }
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) return { success: false, message: data.error?.message || data.raw || `Meta Graph API error (${res.status})` };
    return { success: true, message: `Verified number: ${data.display_phone_number || data.verified_name}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/** Plain text send - used for ad-hoc "Test WhatsApp" messages within an open session/test number. */
exports.send = async (config, { mobile, message }) => {
  const to = normalizeE164(mobile);
  if (!to) return { success: false, error: 'No mobile number' };

  try {
    const res = await fetch(messagesUrl(config.phoneNumberId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: message }
      })
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) return { success: false, error: data.error?.message || data.raw || `Meta Graph API error (${res.status})`, providerResponse: data };
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/** Template send with a document header - used for business-initiated messages like fee receipts. */
exports.sendDocument = async (config, { mobile, documentUrl, filename, bodyParams = [] }) => {
  const to = normalizeE164(mobile);
  if (!to) return { success: false, error: 'No mobile number' };
  if (!config.templateName) return { success: false, error: 'WhatsApp template name not configured' };

  try {
    const res = await fetch(messagesUrl(config.phoneNumberId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: config.languageCode || 'en_US' },
          components: [
            { type: 'header', parameters: [{ type: 'document', document: { link: documentUrl, filename } }] },
            ...(bodyParams.length
              ? [{ type: 'body', parameters: bodyParams.map((v) => ({ type: 'text', text: String(v) })) }]
              : [])
          ]
        }
      })
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) return { success: false, error: data.error?.message || data.raw || `Meta Graph API error (${res.status})`, providerResponse: data };
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
