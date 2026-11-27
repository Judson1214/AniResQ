import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/config/supabase';

describe('lib/api interceptors and queryClient retry policies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    queryClient.clear();
  });

  it('queryClient retry callback never retries 401, 403, 404, or 429 errors', () => {
    const retryFn = queryClient.getDefaultOptions().queries.retry;
    expect(typeof retryFn).toBe('function');

    // 401 Unauthorized -> NO retry
    expect(retryFn(0, { response: { status: 401 } })).toBe(false);

    // 403 Forbidden -> NO retry
    expect(retryFn(0, { response: { status: 403 } })).toBe(false);

    // 404 Not Found -> NO retry
    expect(retryFn(0, { response: { status: 404 } })).toBe(false);

    // 429 Rate Limited -> NO retry
    expect(retryFn(0, { response: { status: 429 } })).toBe(false);

    // 500 Server Error -> retries once (failureCount = 0 -> true, failureCount = 1 -> false)
    expect(retryFn(0, { response: { status: 500 } })).toBe(true);
    expect(retryFn(1, { response: { status: 500 } })).toBe(false);
  });

  it('401 response interceptor clears auth state, empties query cache, and triggers redirect', async () => {
    // Set authenticated state in store
    useAuthStore.getState().setUser({ id: 'usr-123', email: 'test@example.com' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });
    const clearQuerySpy = vi.spyOn(queryClient, 'clear');

    // Mock window.location
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      pathname: '/rescues/report',
      search: '?urgency=high',
      href: '',
    };

    // Find the error rejection interceptor from axios instance
    const responseInterceptor = api.interceptors.response.handlers[0].rejected;

    const mock401Error = {
      response: {
        status: 401,
        data: { detail: 'Token expired' },
      },
    };

    await expect(responseInterceptor(mock401Error)).rejects.toEqual(mock401Error);

    // Verify cleanup
    expect(signOutSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(clearQuerySpy).toHaveBeenCalled();

    // Verify safe redirect target
    expect(window.location.href).toBe('/login?returnTo=%2Frescues%2Freport%3Furgency%3Dhigh');

    // Restore location
    window.location = originalLocation;
  });

  it('429 response interceptor notifies user and handles rate limiting safely', async () => {
    const responseInterceptor = api.interceptors.response.handlers[0].rejected;

    const mock429Error = {
      response: {
        status: 429,
        data: { detail: 'Too many requests. Slow down.' },
        headers: { 'retry-after': '30' },
      },
    };

    await expect(responseInterceptor(mock429Error)).rejects.toEqual(mock429Error);
  });

  it('request interceptor attaches authorization header when session token exists', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt-token-xyz' },
      },
    });

    const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };
    const updatedConfig = await requestInterceptor(config);

    expect(updatedConfig.headers.Authorization).toBe('Bearer fake-jwt-token-xyz');
  });

  it('request interceptor omits authorization header when no session exists', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
    });

    const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };
    const updatedConfig = await requestInterceptor(config);

    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });
});
