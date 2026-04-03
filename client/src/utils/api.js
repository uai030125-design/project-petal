import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request; handle FormData content type
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ua_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Let axios set Content-Type for FormData (with boundary)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ua_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
