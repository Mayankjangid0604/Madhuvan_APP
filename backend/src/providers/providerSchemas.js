/**
 * Describes each channel's providers: which fields are required to save a
 * config, and which of those fields are secrets that must be encrypted at
 * rest and never sent back to the frontend in the clear.
 *
 * This is the single source of truth shared by settings.service.js
 * (encryption/masking) and the provider factories (validation).
 */
module.exports = {
  email: {
    gmail: {
      label: "Google Gmail (OAuth)",
      requiredFields: ["clientId", "clientSecret", "refreshToken", "fromEmail"],
      secretFields: ["clientSecret", "refreshToken"]
    },
    msg91: {
      label: "MSG91 Email",
      requiredFields: ["authKey", "domain", "fromEmail"],
      secretFields: ["authKey"]
    },
    smtp: {
      label: "SMTP (Custom)",
      requiredFields: ["host", "port", "user", "password", "fromEmail"],
      secretFields: ["password"]
    },
    resend: {
      label: "Resend",
      requiredFields: ["apiKey", "fromEmail"],
      secretFields: ["apiKey"]
    }
  },
  sms: {
    msg91: {
      label: "MSG91 SMS",
      requiredFields: ["authKey", "senderId", "templateId"],
      secretFields: ["authKey"]
    },
    twilio: {
      label: "Twilio",
      requiredFields: ["accountSid", "authToken", "fromNumber"],
      secretFields: ["authToken"]
    },
    custom: {
      label: "Custom API",
      requiredFields: ["url"],
      secretFields: ["headersJson"]
    }
  },
  whatsapp: {
    msg91: {
      label: "MSG91 WhatsApp",
      requiredFields: ["authKey", "integratedNumber", "namespace", "templateName"],
      secretFields: ["authKey"]
    },
    meta: {
      label: "Meta WhatsApp Cloud API",
      requiredFields: ["phoneNumberId", "accessToken", "templateName"],
      secretFields: ["accessToken"]
    },
    twilio: {
      label: "Twilio WhatsApp",
      requiredFields: ["accountSid", "authToken", "fromNumber"],
      secretFields: ["authToken"]
    }
  }
};
