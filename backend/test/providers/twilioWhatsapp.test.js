const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const twilioWhatsapp = require('../../src/providers/whatsapp/twilioWhatsapp.provider');

const config = { accountSid: 'ACxxx', authToken: 'tok', fromNumber: '+15550001111' };

test('twilioWhatsapp.send: prefixes To/From with whatsapp:', async () => {
  const fetchMock = mockFetch([{ status: 201, body: { sid: 'SM1', status: 'queued' } }]);
  try {
    const result = await twilioWhatsapp.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, true);
    const params = new URLSearchParams(fetchMock.calls[0].options.body);
    assert.equal(params.get('To'), 'whatsapp:+919876543210');
    assert.equal(params.get('From'), 'whatsapp:+15550001111');
  } finally {
    fetchMock.restore();
  }
});

test('twilioWhatsapp.sendDocument: attaches MediaUrl', async () => {
  const fetchMock = mockFetch([{ status: 201, body: { sid: 'SM2', status: 'queued' } }]);
  try {
    const result = await twilioWhatsapp.sendDocument(config, {
      mobile: '9876543210',
      documentUrl: 'https://example.com/receipt.pdf',
      filename: 'Receipt.pdf'
    });
    assert.equal(result.success, true);
    const params = new URLSearchParams(fetchMock.calls[0].options.body);
    assert.equal(params.get('MediaUrl'), 'https://example.com/receipt.pdf');
  } finally {
    fetchMock.restore();
  }
});

test('twilioWhatsapp.send: error surfaces the Twilio message', async () => {
  const fetchMock = mockFetch([{ status: 400, body: { message: 'Channel not found' } }]);
  try {
    const result = await twilioWhatsapp.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'Channel not found');
  } finally {
    fetchMock.restore();
  }
});
