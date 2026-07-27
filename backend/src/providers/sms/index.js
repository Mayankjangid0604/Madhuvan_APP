/**
 * SmsProvider factory. Every module implements:
 *   testConnection(config) => Promise<{ success, message }>
 *   send(config, { mobile, message }) => Promise<{ success, providerResponse?, error? }>
 */
const msg91 = require('./msg91Sms.provider');
const twilio = require('./twilioSms.provider');
const custom = require('./customSms.provider');

const PROVIDERS = { msg91, twilio, custom };

exports.getProvider = (key) => {
  const provider = PROVIDERS[key];
  if (!provider) throw new Error(`Unknown SMS provider: ${key}`);
  return provider;
};

exports.PROVIDERS = PROVIDERS;
