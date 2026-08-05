const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
const DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const hmac = (data) =>
  crypto.createHmac('sha256', SECRET).update(String(data)).digest('hex').slice(0, 32);

const sign = (value, { expiresInMs = DEFAULT_EXPIRY_MS } = {}) => {
  const expires = Date.now() + expiresInMs;
  const payload = `${value}:${expires}`;
  const token = hmac(payload);
  return `${token}:${expires}`;
};

const verify = (value, token) => {
  if (!token) return false;
  const parts = String(token).split(':');

  // Support legacy tokens without expiry (plain 32-char hex)
  if (parts.length === 1) {
    const expected = hmac(value);
    const a = Buffer.from(expected);
    const b = Buffer.from(parts[0]);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // New format: "hmac:expires"
  const [sig, expiresStr] = [parts[0], parts[1]];
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  const payload = `${value}:${expiresStr}`;
  const expected = hmac(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { sign, verify };
