const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const msg91Whatsapp = require('../../src/providers/whatsapp/msg91Whatsapp.provider');

const config = { authKey: 'key123', integratedNumber: '911234567890', namespace: 'ns1', templateName: 'fee_receipt' };

test('msg91Whatsapp.send: plain text message', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'success' } }]);
  try {
    const result = await msg91Whatsapp.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, true);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(body.recipient_number, '919876543210');
    assert.equal(body.content_type, 'text');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Whatsapp.sendDocument: builds a template payload with a document header', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'success' } }]);
  try {
    const result = await msg91Whatsapp.sendDocument(config, {
      mobile: '9876543210',
      documentUrl: 'https://example.com/receipt.pdf',
      filename: 'Receipt.pdf',
      bodyParams: ['John', '5000']
    });
    assert.equal(result.success, true);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(body.payload.template.name, 'fee_receipt');
    const components = body.payload.template.to_and_components[0].components;
    assert.equal(components.header_1.value, 'https://example.com/receipt.pdf');
    assert.equal(components.body_1.value, 'John');
  } finally {
    fetchMock.restore();
  }
});

test('msg91Whatsapp.sendDocument: missing template name fails without a network call', async () => {
  const fetchMock = mockFetch([]);
  try {
    const result = await msg91Whatsapp.sendDocument(
      { authKey: 'key123', integratedNumber: '911234567890' },
      { mobile: '9876543210', documentUrl: 'https://example.com/r.pdf', filename: 'r.pdf' }
    );
    assert.equal(result.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('msg91Whatsapp.testConnection: provider rejection surfaces as failure', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { type: 'error', message: 'Invalid integrated number' } }]);
  try {
    const result = await msg91Whatsapp.testConnection(config);
    assert.equal(result.success, false);
  } finally {
    fetchMock.restore();
  }
});
