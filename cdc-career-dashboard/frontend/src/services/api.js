import axios from 'axios';

// In production builds (NODE_ENV=production, set by CRA), default to '' so all
// API calls use relative paths — works when Express serves the React build from
// the same origin. In development, fall back to localhost:5000.
const API_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

const api = axios.create({ baseURL: API_URL });

// Attach the staff auth token to every request (no-op for student sessions without a token)
api.interceptors.request.use((config) => {
  try {
    const saved = sessionStorage.getItem('cdc_auth');
    if (saved) {
      const { token } = JSON.parse(saved);
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Student endpoints
export const searchStudents       = (query)     => api.get(`/api/student/search?q=${encodeURIComponent(query)}`);
export const getStudentProfile    = (studentId) => api.get(`/api/student/profile/${studentId}`);
export const getStudentEvents     = (studentId) => api.get(`/api/student/events/${studentId}`);
export const getStudentApplications = (studentId) => api.get(`/api/student/applications/${studentId}`);
export const getStudentInterviews = (studentId) => api.get(`/api/student/interviews/${studentId}`);

// Staff endpoints
export const getAllStudents      = ()          => api.get('/api/staff/students');
export const getStudentDetail   = (studentId) => api.get(`/api/staff/students/${studentId}`);
export const getDashboardSummary = ()         => api.get('/api/staff/dashboard');
export const getStaffAnalytics  = ()          => api.get('/api/staff/analytics');

// Admin endpoints
export const resyncStudents = ()      => api.post('/api/admin/resync');
export const resetAllData   = ()      => api.post('/api/admin/reset');

export const uploadCSV = (files) => {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  return api.post('/api/admin/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Roadmap endpoints
export const getRoadmap        = ()          => api.get('/api/roadmap');
export const getAdminRoadmap   = ()          => api.get('/api/roadmap/admin');
export const createRoadmapTask = (data)      => api.post('/api/roadmap', data);
export const updateRoadmapTask = (id, data)  => api.put(`/api/roadmap/${id}`, data);
export const deleteRoadmapTask = (id)        => api.delete(`/api/roadmap/${id}`);

// Auth endpoints
export const loginStaff = (password) => api.post('/api/auth/staff', { password });

// Task completion endpoints
export const getTaskCompletions  = (studentId)            => api.get(`/api/tasks/${studentId}`);
export const saveTaskCompletion  = (studentId, taskKey, data) => api.put(`/api/tasks/${studentId}/${encodeURIComponent(taskKey)}`, data);
export const deleteTaskCompletion = (studentId, taskKey)  => api.delete(`/api/tasks/${studentId}/${encodeURIComponent(taskKey)}`);

export default api;
