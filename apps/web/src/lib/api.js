import axios from 'axios';
import { auth } from '@/config/firebase';

const api = axios.create({
  baseURL: '/api',
});

// Add a request interceptor to automatically attach the Firebase token
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
