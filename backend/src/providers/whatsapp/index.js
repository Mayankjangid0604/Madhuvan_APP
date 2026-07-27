/**
 * WhatsappProvider factory. Every module implements:
 *   testConnection(config) => Promise<{ success, message }>
 *   send(config, { mobile, message }) => Promise<{ success, providerResponse?, error? }>
 *   sendDocument(config, { mobile, documentUrl, filename, bodyParams }) => Promise<{ success, providerResponse?, error? }>
 */
const msg91 = require('./msg91Whatsapp.provider');
const meta = require('./metaWhatsapp.provider');
const twilio = require('./twilioWhatsapp.provider');

const PROVIDERS = { msg91, meta, twilio };

exports.getProvider = (key) => {
  const provider = PROVIDERS[key];
  if (!provider) throw new Error(`Unknown WhatsApp provider: ${key}`);
  return provider;
};

exports.PROVIDERS = PROVIDERS;
