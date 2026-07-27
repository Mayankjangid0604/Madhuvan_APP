const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const twilioSms = require('../../src/providers/sms/twilioSms.provider');

const config = { accountSid: 'ACxxx', authToken: 'tok', fromNumber: '+15550001111' };

test('twilioSms.send: success', async () => {
  const fetchMock = mockFetch([{ status: 201, body: { sid: 'SM123', status: 'queued' } }]);
  try {
    const result = await twilioSms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, true);
    assert.equal(result.providerResponse.sid, 'SM123');
    const params = new URLSearchParams(fetchMock.calls[0].options.body);
    assert.equal(params.get('To'), '+919876543210');
    assert.equal(params.get('From'), '+15550001111');
  } finally {
    fetchMock.restore();
  }
});

test('twilioSms.send: 4xx error surfaces the Twilio message', async () => {
  const fetchMock = mockFetch([{ status: 400, body: { message: 'The From number is not verified' } }]);
  try {
    const result = await twilioSms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'The From number is not verified');
  } finally {
    fetchMock.restore();
  }
});

test('twilioSms.send: non-JSON error body degrades gracefully', async () => {
  const fetchMock = mockFetch([{ status: 403, body: 'Host not in allowlist: api.twilio.com' }]);
  try {
    const result = await twilioSms.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.match(result.error, /Host not in allowlist/);
  } finally {
    fetchMock.restore();
  }
});

test('twilioSms.testConnection: success reads the account status', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { status: 'active' } }]);
  try {
    const result = await twilioSms.testConnection(config);
    assert.equal(result.success, true);
    assert.match(result.message, /active/);
  } finally {
    fetchMock.restore();
  }
});

test('twilioSms.testConnection: missing credentials fails fast', async () => {
  const fetchMock = mockFetch([]);
  try {
    const result = await twilioSms.testConnection({});
    assert.equal(result.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});
