const fillTemplate = (template, vars) => {
  let s = String(template ?? '');
  Object.entries(vars).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(String(v ?? ''));
  });
  return s;
};

const parseHeaders = (headersJson) => {
  if (!headersJson) return {};
  try {
    return JSON.parse(headersJson);
  } catch {
    return {};
  }
};

const callCustomApi = async (config, { mobile, message }) => {
  const method = (config.method || 'POST').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...parseHeaders(config.headersJson) };
  const bodyTemplate = config.bodyTemplate || '{"mobile":"{{mobile}}","message":"{{message}}"}';
  const filledBody = fillTemplate(bodyTemplate, { mobile, message });

  const res = await fetch(config.url, {
    method,
    headers,
    body: method === 'GET' ? undefined : filledBody
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
};

exports.testConnection = async (config) => {
  if (!config.url) return { success: false, message: 'API URL is required' };
  try {
    const result = await callCustomApi(config, { mobile: '9999999999', message: 'Connection test' });
    if (!result.ok) return { success: false, message: `Custom API returned ${result.status}` };
    return { success: true, message: `Custom API responded with ${result.status}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { mobile, message }) => {
  if (!mobile) return { success: false, error: 'No mobile number' };
  try {
    const result = await callCustomApi(config, { mobile, message });
    if (!result.ok) return { success: false, error: `Custom API returned ${result.status}`, providerResponse: result.data };
    return { success: true, providerResponse: result.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
