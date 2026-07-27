const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const smtp = require('../../src/providers/email/smtp.provider');

const config = { host: 'smtp.example.com', port: 587, user: 'me@example.com', password: 'secret', fromEmail: 'me@example.com', fromName: 'Hostel' };

test('smtp.send: success', async (t) => {
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (opts) => {
      assert.equal(opts.to, 'parent@example.com');
      assert.equal(opts.subject, 'Hi');
      return { messageId: 'abc123' };
    },
    verify: async () => true
  }));

  const result = await smtp.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>', attachments: [] });
  assert.equal(result.success, true);
  assert.equal(result.providerResponse.messageId, 'abc123');
});

test('smtp.send: transport error surfaces as failure', async (t) => {
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => { throw new Error('Connection refused'); }
  }));

  const result = await smtp.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Connection refused');
});

test('smtp.testConnection: verifies the transport', async (t) => {
  t.mock.method(nodemailer, 'createTransport', () => ({
    verify: async () => true
  }));

  const result = await smtp.testConnection(config);
  assert.equal(result.success, true);
});

test('smtp.testConnection: reports verify failures', async (t) => {
  t.mock.method(nodemailer, 'createTransport', () => ({
    verify: async () => { throw new Error('ENOTFOUND'); }
  }));

  const result = await smtp.testConnection(config);
  assert.equal(result.success, false);
  assert.equal(result.message, 'ENOTFOUND');
});
