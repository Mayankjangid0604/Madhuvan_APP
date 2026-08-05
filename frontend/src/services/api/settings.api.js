import api from "./axiosInstance";

export const settingsAPI = {
  getHostelInfo() {
    return api.get("/settings/hostel-info");
  },
  saveHostelInfo(formData) {
    return api.post("/settings/hostel-info", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  },
  getRules() {
    return api.get("/settings/rules");
  },
  // ✅ FIX: Send raw array instead of { rules } wrapper
  saveRules(rules) {
    return api.post("/settings/rules", rules);
  },
  getTemplates() {
    return api.get("/settings/templates");
  },
  saveTemplate(kind, data) {
    return api.post(`/settings/templates/${kind}`, data);
  },
  getPublicBaseUrl() {
    return api.get("/settings/public-base-url");
  },
  savePublicBaseUrl(publicBaseUrl) {
    return api.post("/settings/public-base-url", { publicBaseUrl });
  },
  getDriveConfig() {
    return api.get("/settings/drive-config");
  },
  saveDriveConfig(data) {
    return api.post("/settings/drive-config", data);
  },
  getPenaltyConfig() {
    return api.get("/settings/penalty-config");
  },
  savePenaltyConfig(data) {
    return api.post("/settings/penalty-config", data);
  },
  uploadLogo(formData) {
    return api.post("/settings/upload-logo", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  },
  getPhonePeConfig() {
    return api.get("/settings/phonepe-config");
  },
  savePhonePeConfig(data) {
    return api.post("/settings/phonepe-config", data);
  },
  getBackupList() {
    return api.get("/backup/list");
  },
  createBackup() {
    return api.post("/backup/create");
  },
  restoreBackup(filename) {
    return api.post(`/backup/restore/${encodeURIComponent(filename)}`);
  },
  deleteBackup(filename) {
    return api.delete(`/backup/${encodeURIComponent(filename)}`);
  },
  downloadBackup(filename) {
    return api.get(`/backup/download/${encodeURIComponent(filename)}`, { responseType: "blob" });
  },
  uploadBackup(formData) {
    return api.post("/backup/upload-restore", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  }
};