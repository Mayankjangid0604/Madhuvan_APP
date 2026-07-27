const test = require('node:test');
const assert = require('node:assert/strict');
const { mockFetch } = require('../helpers/mockFetch');
const metaWhatsapp = require('../../src/providers/whatsapp/metaWhatsapp.provider');

const config = { phoneNumberId: '123456', accessToken: 'tok', templateName: 'fee_receipt', languageCode: 'en_US' };

test('metaWhatsapp.send: plain text message', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { messages: [{ id: 'wamid.1' }] } }]);
  try {
    const result = await metaWhatsapp.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, true);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(body.type, 'text');
    assert.equal(body.text.body, 'Hello');
  } finally {
    fetchMock.restore();
  }
});

test('metaWhatsapp.sendDocument: builds a template payload with a document header', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { messages: [{ id: 'wamid.2' }] } }]);
  try {
    const result = await metaWhatsapp.sendDocument(config, {
      mobile: '9876543210',
      documentUrl: 'https://example.com/receipt.pdf',
      filename: 'Receipt.pdf',
      bodyParams: ['John', '5000']
    });
    assert.equal(result.success, true);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.equal(body.template.name, 'fee_receipt');
    assert.equal(body.template.components[0].parameters[0].document.link, 'https://example.com/receipt.pdf');
  } finally {
    fetchMock.restore();
  }
});

test('metaWhatsapp.send: Graph API error surfaces as failure', async () => {
  const fetchMock = mockFetch([{ status: 401, body: { error: { message: 'Invalid OAuth access token' } } }]);
  try {
    const result = await metaWhatsapp.send(config, { mobile: '9876543210', message: 'Hello' });
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid OAuth access token');
  } finally {
    fetchMock.restore();
  }
});

test('metaWhatsapp.testConnection: success returns the verified number', async () => {
  const fetchMock = mockFetch([{ status: 200, body: { display_phone_number: '+1 555 000 1111' } }]);
  try {
    const result = await metaWhatsapp.testConnection(config);
    assert.equal(result.success, true);
    assert.match(result.message, /555 000 1111/);
  } finally {
    fetchMock.restore();
  }
});
