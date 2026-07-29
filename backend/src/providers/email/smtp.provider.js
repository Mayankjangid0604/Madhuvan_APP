const nodemailer = require('nodemailer');
const fs = require('fs');

const buildTransport = (config) =>
  nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth: { user: config.user, pass: config.password }
  });

exports.testConnection = async (config) => {
  try {
    const transport = buildTransport(config);
    await transport.verify();
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

exports.send = async (config, { to, subject, html, attachments = [] }) => {
  try {
    const transport = buildTransport(config);
    const from = config.fromName ? `"${config.fromName}" <${config.fromEmail || config.user}>` : (config.fromEmail || config.user);

    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      attachments: attachments
        .filter((a) => a && a.path && fs.existsSync(a.path))
        .map((a) => ({ filename: a.filename, path: a.path }))
    });
    return { success: true, providerResponse: { messageId: info.messageId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
