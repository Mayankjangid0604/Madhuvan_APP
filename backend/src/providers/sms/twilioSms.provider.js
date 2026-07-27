const { parseJsonResponse } = require('../httpJson.util');

const basicAuth = (sid, token) => Buffer.from(`${sid}:${token}`).toString('base64');

const normalizeE164 = (mobile) => {
  if (!mobile) return null;
  let m = String(mobile).trim();
  if (!m.startsWith('+')) {
    const digits = m.replace(/\D/g, '').replace(/^0+/, '');
    m = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }
  return m;
};

exports.testConnection = async (config) => {
  if (!config.accountSid || !config.authToken) {
    return { success: false, message: 'Account SID and Auth Token are required' };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`, {
      headers: { Authorization: `Basic ${basicAuth(config.accountSid, config.authToken)}` }
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) return { success: false, message: data.message || data.raw || `Twilio auth failed (${res.status})` };
    return { success: true, message: `Authenticated - account status: ${data.status}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { mobile, message }) => {
  const to = normalizeE164(mobile);
  if (!to) return { success: false, error: 'No mobile number' };

  try {
    const body = new URLSearchParams({ To: to, From: config.fromNumber, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth(config.accountSid, config.authToken)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      return { success: false, error: data.message || data.raw || `Twilio request failed (${res.status})`, providerResponse: data };
    }
    return { success: true, providerResponse: { sid: data.sid, status: data.status } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
