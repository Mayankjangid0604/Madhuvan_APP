// Presentation hints for provider config fields. Keys not listed here just
// render as a plain text input with a title-cased label.
export const FIELD_META = {
  clientId: { label: "Client ID", type: "text" },
  clientSecret: { label: "Client Secret", type: "password" },
  refreshToken: { label: "Refresh Token", type: "password" },
  fromEmail: { label: "From Email", type: "email" },
  fromName: { label: "From Name", type: "text" },
  authKey: { label: "Auth Key", type: "password" },
  domain: { label: "Sending Domain", type: "text" },
  templateId: { label: "Template ID", type: "text" },
  host: { label: "SMTP Host", type: "text" },
  port: { label: "Port", type: "number" },
  user: { label: "SMTP Username", type: "text" },
  password: { label: "SMTP Password", type: "password" },
  senderId: { label: "Sender ID", type: "text" },
  route: { label: "Route", type: "text" },
  accountSid: { label: "Account SID", type: "text" },
  authToken: { label: "Auth Token", type: "password" },
  fromNumber: { label: "From Number", type: "text" },
  url: { label: "API URL", type: "text" },
  headersJson: { label: "Headers (JSON)", type: "password" },
  integratedNumber: { label: "Integrated Number", type: "text" },
  namespace: { label: "Namespace", type: "text" },
  templateName: { label: "Template Name", type: "text" },
  phoneNumberId: { label: "Phone Number ID", type: "text" },
  accessToken: { label: "Access Token", type: "password" },
  languageCode: { label: "Language Code", type: "text" }
};

export const fieldMeta = (name) =>
  FIELD_META[name] || { label: name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), type: "text" };
