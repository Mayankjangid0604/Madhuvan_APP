const test = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const gmail = require('../../src/providers/email/gmail.provider');

const config = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', fromEmail: 'me@example.com', fromName: 'Hostel' };

function withMockedGoogle(oauthImpl, gmailImpl, fn) {
  const originalOAuth2 = google.auth.OAuth2;
  const originalGmail = google.gmail;
  google.auth.OAuth2 = function MockOAuth2() {
    return oauthImpl;
  };
  google.gmail = () => gmailImpl;
  return fn().finally(() => {
    google.auth.OAuth2 = originalOAuth2;
    google.gmail = originalGmail;
  });
}

test('gmail.testConnection: success returns the authenticated address', async () => {
  await withMockedGoogle(
    { setCredentials: () => {}, getAccessToken: async () => ({ token: 'tok' }) },
    { users: { getProfile: async () => ({ data: { emailAddress: 'me@example.com' } }) } },
    async () => {
      const result = await gmail.testConnection(config);
      assert.equal(result.success, true);
      assert.match(result.message, /me@example\.com/);
    }
  );
});

test('gmail.testConnection: invalid refresh token fails gracefully', async () => {
  await withMockedGoogle(
    { setCredentials: () => {}, getAccessToken: async () => { throw new Error('invalid_grant'); } },
    {},
    async () => {
      const result = await gmail.testConnection(config);
      assert.equal(result.success, false);
      assert.equal(result.message, 'invalid_grant');
    }
  );
});

test('gmail.send: success returns the sent message id', async () => {
  await withMockedGoogle(
    { setCredentials: () => {}, getAccessToken: async () => ({ token: 'tok' }) },
    { users: { messages: { send: async () => ({ data: { id: 'msg1', threadId: 'th1' } }) } } },
    async () => {
      const result = await gmail.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>', attachments: [] });
      assert.equal(result.success, true);
      assert.equal(result.providerResponse.id, 'msg1');
    }
  );
});

test('gmail.send: API error surfaces as failure', async () => {
  await withMockedGoogle(
    { setCredentials: () => {}, getAccessToken: async () => ({ token: 'tok' }) },
    { users: { messages: { send: async () => { throw { response: { data: { error: { message: 'quota exceeded' } } } }; } } } },
    async () => {
      const result = await gmail.send(config, { to: 'parent@example.com', subject: 'Hi', html: '<p>Hi</p>' });
      assert.equal(result.success, false);
      assert.equal(result.error, 'quota exceeded');
    }
  );
});
