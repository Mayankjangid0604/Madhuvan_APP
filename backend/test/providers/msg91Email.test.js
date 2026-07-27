const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const msg91Email = require('../../src/providers/email/msg91Email.provider');

const config = { authKey: 'key123', domain: 'example.com', fromEmail: 'noreply@example.com', fromName: 'Hostel' };

test('msg91Email.send: success', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { message: 'Mail sent', type: 'success' } }]);
  try {
    const result = await msg91Email.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>', attachments: [] });
    assert.equal(result.success, true);
    assert.equal(fetchMock.calls.length, 1);
    assert.equal(fetchMock.calls[0].url, 'https://api.msg91.com/api/v5/email/send');
    const sentBody = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(sentBody.recipients[0].to[0].email, 'parent@example.com');
    assert.equal(sentBody.domain, 'example.com');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Email.send: provider error surfaces as failure', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'error', message: 'Invalid authkey' } }]);
  try {
    const result = await msg91Email.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid authkey');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Email.testConnection: missing fields fails fast without a network call', async () => {
  const fetchMock = mockFetch([]);
  try {
    const result = await msg91Email.testConnection({ authKey: '' });
    assert.equal(result.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('msg91Email.testConnection: succeeds when MSG91 accepts the dry-run request', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { message: 'ok' } }]);
  try {
    const result = await msg91Email.testConnection(config);
    assert.equal(result.success, true);
  } finally {
    fetchMock.restore();
  }
});
