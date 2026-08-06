import api from "./axiosInstance";

export const studentAPI = {
  createStudent(data) {
    return api.post("/students", data);
  },

  getStudents(config) {
    return api.get("/students", config);
  },

  getStudentById(id) {
    return api.get(`/students/${id}`);
  },

  updateStudent(id, data) {
    return api.put(`/students/${id}`, data);
  },

  uploadPhoto(id, formData) {
    return api.post(`/students/${id}/photo`, formData);
  },

  exitStudent(id) {
    return api.post(`/students/${id}/exit`);
  },

  deleteStudent(id) {
    return api.delete(`/students/${id}`);
  },

  hardDeleteStudent(id) {
    return api.delete(`/students/${id}`);
  },
};