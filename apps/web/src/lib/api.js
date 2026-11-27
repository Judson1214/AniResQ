import axios from 'axios';
import { supabase } from '@/config/supabase';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';
import { sanitizeReturnTo } from '@/lib/utils';

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

// Add a response interceptor to handle token expiry / 401 Unauthorized and 429 Rate Limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out errors on network failure
      }
      useAuthStore.getState().clearAuth();
      queryClient.clear();

      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const currentPath = window.location.pathname + window.location.search;
        const safePath = sanitizeReturnTo(currentPath);
        window.location.href = `/login?returnTo=${encodeURIComponent(safePath)}`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
