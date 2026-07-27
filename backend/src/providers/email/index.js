/**
 * EmailProvider factory. Every module here implements the same contract:
 *   testConnection(config) => Promise<{ success, message }>
 *   send(config, { to, toName, subject, html, attachments }) => Promise<{ success, providerResponse?, error? }>
 */
const gmail = require('./gmail.provider');
const msg91 = require('./msg91Email.provider');
const smtp = require('./smtp.provider');

const PROVIDERS = { gmail, msg91, smtp };

exports.getProvider = (key) => {
  const provider = PROVIDERS[key];
  if (!provider) throw new Error(`Unknown email provider: ${key}`);
  return provider;
};

exports.PROVIDERS = PROVIDERS;
