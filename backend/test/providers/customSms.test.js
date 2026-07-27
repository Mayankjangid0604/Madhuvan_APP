const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const customSms = require('../../src/providers/sms/customSms.provider');

const config = {
  url: 'https://sms.example.com/send',
  method: 'POST',
  headersJson: '{"X-Api-Key":"abc123"}',
  bodyTemplate: '{"to":"{{mobile}}","text":"{{message}}"}'
};

test('customSms.send: fills the body template and forwards custom headers', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { ok: true } }]);
  try {
    const result = await customSms.send(config, { mobile: '9876543210', message: 'Hello there' });
    assert.equal(result.success, true);
    assert.equal(fetchMock.calls[0].options.headers['X-Api-Key'], 'abc123');
    const sentBody = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(sentBody.to, '9876543210');
    assert.equal(sentBody.text, 'Hello there');
  } finally {
    fetchMock.restore();
  }
});

test('customSms.send: non-2xx response is reported as failure', async () => {
  const fetchMock = mockFetch([{ status: 500, body: { error: 'Internal error' } }]);
  try {
    const result = await customSms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.match(result.error, /500/);
  } finally {
    fetchMock.restore();
  }
});

test('customSms.testConnection: missing URL fails without a network call', async () => {
  const fetchMock = mockFetch([]);
  try {
    const result = await customSms.testConnection({});
    assert.equal(result.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});
