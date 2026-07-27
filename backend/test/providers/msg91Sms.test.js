const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const msg91Sms = require('../../src/providers/sms/msg91Sms.provider');

const config = { authKey: 'key123', senderId: 'MDHVAN', route: '4', templateId: 'tpl1' };

test('msg91Sms.send: success normalizes a 10-digit mobile to 91-prefixed', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'success', message: 'queued' } }]);
  try {
    const result = await msg91Sms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, true);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(body.recipients[0].mobiles, '919876543210');
    assert.equal(body.template_id, 'tpl1');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Sms.send: missing template id fails without a network call', async () => {
  const fetchMock = mockFetch([]);
  try {
    const result = await msg91Sms.send({ authKey: 'key123' }, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('msg91Sms.send: provider error surfaces as failure', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'error', message: 'Invalid template' } }]);
  try {
    const result = await msg91Sms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid template');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Sms.testConnection: reads balance on success', async () => {
  const fetchMock = mockFetch([{ status: 200, body: '42.50' }]);
  try {
    const result = await msg91Sms.testConnection(config);
    assert.equal(result.success, true);
    assert.match(result.message, /42.50/);
  } finally {
    fetchMock.restore();
  }
});

test('msg91Sms.testConnection: non-numeric response means invalid key', async () => {
  const fetchMock = mockFetch([{ status: 200, body: 'Invalid authentication key' }]);
  try {
    const result = await msg91Sms.testConnection(config);
    assert.equal(result.success, false);
  } finally {
    fetchMock.restore();
  }
});
