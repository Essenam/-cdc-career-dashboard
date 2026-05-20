import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL
});

// Student endpoints
export const searchStudents = (query) =>
  api.get(`/api/student/search?q=${encodeURIComponent(query)}`);

export const getStudentProfile = (studentId) =>
  api.get(`/api/student/profile/${studentId}`);

export const getStudentEvents = (studentId) => 
  api.get(`/api/student/events/${studentId}`);

export const getStudentApplications = (studentId) => 
  api.get(`/api/student/applications/${studentId}`);

export const getStudentInterviews = (studentId) => 
  api.get(`/api/student/interviews/${studentId}`);

// Staff endpoints
export const getAllStudents = () => 
  api.get('/api/staff/students');

export const getStudentDetail = (studentId) =>
  api.get(`/api/staff/students/${studentId}`);

export const getDashboardSummary = () =>
  api.get('/api/staff/dashboard');

export const getStaffAnalytics = () =>
  api.get('/api/staff/analytics');

// Admin endpoints
export const resyncStudents = () =>
  api.post('/api/admin/resync');

export const resetAllData = () =>
  api.post('/api/admin/reset');

export const uploadCSV = (files) => {
  const formData = new FormData();
  for (let file of files) {
    formData.append('files', file);
  }
  return api.post('/api/admin/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Roadmap endpoints
export const getRoadmap = () => api.get('/api/roadmap');
export const getAdminRoadmap = () => api.get('/api/roadmap/admin');
export const createRoadmapTask = (data) => api.post('/api/roadmap', data);
export const updateRoadmapTask = (id, data) => api.put(`/api/roadmap/${id}`, data);
export const deleteRoadmapTask = (id) => api.delete(`/api/roadmap/${id}`);

// Auth endpoints
export const loginStaff = (password) =>
  api.post('/api/auth/staff', { password });

// Task completion endpoints
export const getTaskCompletions = (studentId) =>
  api.get(`/api/tasks/${studentId}`);

export const saveTaskCompletion = (studentId, taskKey, data) =>
  api.put(`/api/tasks/${studentId}/${encodeURIComponent(taskKey)}`, data);

export const deleteTaskCompletion = (studentId, taskKey) =>
  api.delete(`/api/tasks/${studentId}/${encodeURIComponent(taskKey)}`);

export default api;