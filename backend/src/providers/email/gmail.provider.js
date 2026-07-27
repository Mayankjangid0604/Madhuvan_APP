const { google } = require('googleapis');

/**
 * EmailProvider: Google Gmail via OAuth2 (googleapis Gmail API).
 * config: { clientId, clientSecret, refreshToken, fromEmail, fromName }
 *
 * The refresh token is obtained once out-of-band (e.g. Google OAuth
 * Playground with the gmail.send scope) and pasted into Settings -
 * this app never runs an interactive OAuth consent flow itself.
 */
const buildClient = (config) => {
  const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret);
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });
  return oauth2Client;
};

const buildRawMessage = ({ from, to, subject, html, attachments = [] }) => {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject || '').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html || '',
    ''
  ];

  for (const att of attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      att.content,
      ''
    );
  }
  lines.push(`--${boundary}--`);

  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

exports.testConnection = async (config) => {
  try {
    const client = buildClient(config);
    await client.getAccessToken();
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return { success: true, message: `Authenticated as ${profile.data.emailAddress}` };
  } catch (error) {
    return { success: false, message: error.response?.data?.error_description || error.message };
  }
};

exports.send = async (config, { to, subject, html, attachments = [] }) => {
  const fs = require('fs');
  const encodedAttachments = attachments
    .filter((a) => a && a.path && fs.existsSync(a.path))
    .map((a) => ({ filename: a.filename, content: fs.readFileSync(a.path).toString('base64') }));

  const client = buildClient(config);
  const gmail = google.gmail({ version: 'v1', auth: client });
  const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;

  try {
    const raw = buildRawMessage({ from, to, subject, html, attachments: encodedAttachments });
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { success: true, providerResponse: { id: res.data.id, threadId: res.data.threadId } };
  } catch (error) {
    return { success: false, error: error.response?.data?.error?.message || error.message };
  }
};
