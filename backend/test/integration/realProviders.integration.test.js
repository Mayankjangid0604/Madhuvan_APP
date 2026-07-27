/**
 * Integration tests against the real provider APIs. These make actual
 * network calls and are skipped unless the matching credentials are
 * supplied via environment variables - they are never run as part of the
 * default unit test run / CI, only when explicitly exercising a live
 * account (e.g. locally, with a throwaway test recipient).
 *
 * Example:
 *   TEST_MSG91_AUTHKEY=xxx TEST_MSG91_SENDER_ID=XXX TEST_MSG91_TEMPLATE_ID=xxx \
 *   TEST_SMS_TO=9199999999 node --test test/integration/realProviders.integration.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const msg91Sms = require('../../src/providers/sms/msg91Sms.provider');
const twilioSms = require('../../src/providers/sms/twilioSms.provider');
const msg91Email = require('../../src/providers/email/msg91Email.provider');
const smtp = require('../../src/providers/email/smtp.provider');

test('MSG91 SMS: real send', { skip: !process.env.TEST_MSG91_AUTHKEY && 'set TEST_MSG91_AUTHKEY, TEST_MSG91_TEMPLATE_ID, TEST_SMS_TO to run' }, async (t) => {
  const result = await msg91Sms.send(
    { authKey: process.env.TEST_MSG91_AUTHKEY, senderId: process.env.TEST_MSG91_SENDER_ID, templateId: process.env.TEST_MSG91_TEMPLATE_ID },
    { mobile: process.env.TEST_SMS_TO, message: 'Automated integration test from Madhuvan' }
  );
  assert.ok(result.success, result.error);
});

test('Twilio SMS: real send', { skip: !process.env.TEST_TWILIO_SID && 'set TEST_TWILIO_SID, TEST_TWILIO_TOKEN, TEST_TWILIO_FROM, TEST_SMS_TO to run' }, async (t) => {
  const result = await twilioSms.send(
    { accountSid: process.env.TEST_TWILIO_SID, authToken: process.env.TEST_TWILIO_TOKEN, fromNumber: process.env.TEST_TWILIO_FROM },
    { mobile: process.env.TEST_SMS_TO, message: 'Automated integration test from Madhuvan' }
  );
  assert.ok(result.success, result.error);
});

test('MSG91 Email: real send', { skip: !process.env.TEST_MSG91_AUTHKEY && 'set TEST_MSG91_AUTHKEY, TEST_MSG91_DOMAIN, TEST_MSG91_FROM_EMAIL, TEST_EMAIL_TO to run' }, async (t) => {
  const result = await msg91Email.send(
    { authKey: process.env.TEST_MSG91_AUTHKEY, domain: process.env.TEST_MSG91_DOMAIN, fromEmail: process.env.TEST_MSG91_FROM_EMAIL, fromName: 'Madhuvan Test' },
    { to: process.env.TEST_EMAIL_TO, subject: 'Integration test', html: '<p>Automated integration test from Madhuvan</p>', attachments: [] }
  );
  assert.ok(result.success, result.error);
});

test('SMTP: real send', { skip: !process.env.TEST_SMTP_HOST && 'set TEST_SMTP_HOST, TEST_SMTP_USER, TEST_SMTP_PASSWORD, TEST_EMAIL_TO to run' }, async (t) => {
  const result = await smtp.send(
    { host: process.env.TEST_SMTP_HOST, port: process.env.TEST_SMTP_PORT || 587, user: process.env.TEST_SMTP_USER, password: process.env.TEST_SMTP_PASSWORD, fromEmail: process.env.TEST_SMTP_USER, fromName: 'Madhuvan Test' },
    { to: process.env.TEST_EMAIL_TO, subject: 'Integration test', html: '<p>Automated integration test from Madhuvan</p>', attachments: [] }
  );
  assert.ok(result.success, result.error);
});
