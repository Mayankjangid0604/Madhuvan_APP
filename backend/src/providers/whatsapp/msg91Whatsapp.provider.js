const TEXT_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
const TEMPLATE_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

const normalizeMobile = (mobile) => {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
};

const request = async (url, config, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', authkey: config.authKey, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok && data.type !== 'error', data };
};

exports.testConnection = async (config) => {
  if (!config.authKey || !config.integratedNumber) {
    return { success: false, message: 'Auth key and integrated number are required' };
  }
  // MSG91 has no read-only ping endpoint for WhatsApp; validate by sending a
  // plain text message to the integrated number's own number (self-test).
  try {
    const { ok, data } = await request(TEXT_URL, config, {
      integrated_number: config.integratedNumber,
      recipient_number: config.integratedNumber,
      content_type: 'text',
      text: 'Connection test'
    });
    if (!ok) return { success: false, message: data.message || 'MSG91 WhatsApp rejected the test request' };
    return { success: true, message: 'MSG91 WhatsApp accepted the test request' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/**
 * Plain text send - used for ad-hoc "Test WhatsApp" messages. Only reliable
 * within an open customer-service session per WhatsApp's messaging rules.
 */
exports.send = async (config, { mobile, message }) => {
  const to = normalizeMobile(mobile);
  if (!to) return { success: false, error: 'No mobile number' };

  try {
    const { ok, data } = await request(TEXT_URL, config, {
      integrated_number: config.integratedNumber,
      recipient_number: to,
      content_type: 'text',
      text: message
    });
    if (!ok) return { success: false, error: data.message || 'MSG91 WhatsApp request failed', providerResponse: data };
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Template send with a document header - used for business-initiated
 * messages like fee receipts, which require a pre-approved WA template.
 */
exports.sendDocument = async (config, { mobile, documentUrl, filename, bodyParams = [] }) => {
  const to = normalizeMobile(mobile);
  if (!to) return { success: false, error: 'No mobile number' };
  if (!config.templateName) return { success: false, error: 'WhatsApp template name not configured' };

  const components = { header_1: { type: 'document', value: documentUrl, filename } };
  bodyParams.forEach((value, idx) => { components[`body_${idx + 1}`] = { type: 'text', value: String(value) }; });

  try {
    const { ok, data } = await request(TEMPLATE_URL, config, {
      integrated_number: config.integratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: 'en', policy: 'deterministic' },
          namespace: config.namespace,
          to_and_components: [{ to: [to], components }]
        }
      }
    });
    if (!ok) return { success: false, error: data.message || 'MSG91 WhatsApp request failed', providerResponse: data };
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.normalizeMobile = normalizeMobile;
