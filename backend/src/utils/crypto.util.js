const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set to encrypt/decrypt secrets');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a string, returning "iv:authTag:ciphertext" (all hex).
 * Non-string/empty values are passed through unchanged so callers can
 * safely run this over fields that may be blank.
 */
const encrypt = (plainText) => {
  if (plainText === undefined || plainText === null || plainText === '') return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Reverses encrypt(). Values not produced by encrypt() (no "enc:" prefix)
 * are returned unchanged - covers plaintext values written before
 * encryption was introduced, or values that were never encrypted.
 */
const decrypt = (value) => {
  if (typeof value !== 'string' || !value.startsWith('enc:')) return value;
  const [, ivHex, authTagHex, dataHex] = value.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return plain.toString('utf8');
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith('enc:');

module.exports = { encrypt, decrypt, isEncrypted };
