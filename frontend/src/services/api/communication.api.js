import api from "./axiosInstance";

export const communicationAPI = {
  getProviderCatalog() {
    return api.get("/communication/providers");
  },
  getConfig(channel) {
    return api.get(`/communication/config/${channel}`);
  },
  saveProviderConfig(channel, provider, data) {
    return api.post(`/communication/config/${channel}/${provider}`, data);
  },
  testConnection(channel, provider, overrideData) {
    return api.post(`/communication/config/${channel}/${provider}/test`, overrideData || {});
  },
  setActiveProvider(channel, provider) {
    return api.post(`/communication/active/${channel}`, { provider });
  },
  deactivateChannel(channel) {
    return api.post(`/communication/deactivate/${channel}`);
  },
  testSendEmail(data) {
    return api.post("/communication/test-send/email", data);
  },
  testSendSms(data) {
    return api.post("/communication/test-send/sms", data);
  },
  testSendWhatsapp(data) {
    return api.post("/communication/test-send/whatsapp", data);
  },
  getLogs(params) {
    return api.get("/communication/logs", { params });
  }
};
