import api from "./axiosInstance";

export const vendorAPI = {
  getAll() {
    return api.get("/vendors");
  },
  getById(id) {
    return api.get(`/vendors/${id}`);
  },
  create(data) {
    return api.post("/vendors", data);
  },
  update(id, data) {
    return api.put(`/vendors/${id}`, data);
  },
  delete(id) {
    return api.delete(`/vendors/${id}`);
  },
};
