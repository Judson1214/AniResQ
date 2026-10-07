import axios from 'axios';
import { supabase } from '@/config/supabase';

const api = axios.create({
  baseURL: '/api',
});

// Add a request interceptor to automatically attach the Supabase JWT token
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
