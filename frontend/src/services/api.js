import axios from 'axios';
import { getToken, clearAuth } from '../utils/storage';
import { DEFAULT_REQUEST_TIMEOUT } from '../config/constants';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: DEFAULT_REQUEST_TIMEOUT
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const token = getToken();
      if (token) {
        clearAuth();
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
