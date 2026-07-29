const FLOW_URL = 'https://control.msg91.com/api/v5/flow/';
const BALANCE_URL = 'https://api.msg91.com/api/balance.php';

const normalizeMobile = (mobile) => {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
};

exports.testConnection = async (config) => {
  if (!config.authKey) return { success: false, message: 'Auth key is required' };
  try {
    const url = `${BALANCE_URL}?authkey=${encodeURIComponent(config.authKey)}&type=4`;
    const res = await fetch(url);
    const text = (await res.text()).trim();
    // MSG91 balance.php replies with a plain number on success, or an error string.
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return { success: true, message: `Auth key valid - balance: ${text}` };
    }
    return { success: false, message: text || `MSG91 balance check failed (${res.status})` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { mobile, message }) => {
  const to = normalizeMobile(mobile);
  if (!to) return { success: false, error: 'No mobile number' };
  if (!config.templateId) return { success: false, error: 'SMS template/flow ID not configured' };

  try {
    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: { accept: 'application/json', authkey: config.authKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        template_id: config.templateId,
        short_url: '0',
        recipients: [{ mobiles: to, VAR1: message }]
      })
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok || data.type === 'error') {
      return { success: false, error: data.message || `MSG91 request failed (${res.status})`, providerResponse: data };
    }
    return { success: true, providerResponse: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
