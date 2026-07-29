const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;

const sign = (value) =>
  crypto.createHmac('sha256', SECRET).update(String(value)).digest('hex').slice(0, 32);

const verify = (value, token) => {
  if (!token) return false;
  const expected = sign(value);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { sign, verify };
