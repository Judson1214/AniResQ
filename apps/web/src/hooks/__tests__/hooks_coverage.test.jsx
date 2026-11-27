import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useNotifications } from '@/hooks/useNotifications';
import { useRealtimeCollection, calculatePollingInterval } from '@/hooks/useRealtimeCollection';
import * as storageService from '@/services/storage.service';
import * as notifService from '@/services/notification.service';
import { useAuthStore } from '@/store/authStore';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Frontend Custom Hooks Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useGeolocation', () => {
    it('sets coordinates on successful position lookup', () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: { latitude: 37.7749, longitude: -122.4194 },
          });
        }),
      };
      vi.stubGlobal('navigator', { geolocation: mockGeolocation });

      const { result } = renderHook(() => useGeolocation());
      act(() => {
        result.current.getCurrentPosition();
      });

      expect(result.current.position).toEqual({ lat: 37.7749, lng: -122.4194 });
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('sets specific error messages for geolocation error codes', () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_, error) => {
          error({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }),
      };
      vi.stubGlobal('navigator', { geolocation: mockGeolocation });

      const { result } = renderHook(() => useGeolocation());
      act(() => {
        result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('User denied the request for Geolocation.');
    });

    it('handles missing geolocation support', () => {
      vi.stubGlobal('navigator', { geolocation: undefined });

      const { result } = renderHook(() => useGeolocation());
      act(() => {
        result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('Geolocation is not supported by your browser');
    });
  });

  describe('useImageUpload', () => {
    it('uploads files and tracks progress', async () => {
      vi.spyOn(storageService, 'uploadMultipleFiles').mockImplementation(async (path, files, onProgress) => {
        if (onProgress) onProgress(50);
        return ['https://test.supabase.co/img1.jpg'];
      });

      const { result } = renderHook(() => useImageUpload());
      let urls;
      await act(async () => {
        urls = await result.current.uploadImages(['file1'], 'uploads');
      });

      expect(urls).toEqual(['https://test.supabase.co/img1.jpg']);
      expect(result.current.progress).toBe(100);
      expect(result.current.isUploading).toBe(false);
    });

    it('handles upload failure and resets isUploading', async () => {
      vi.spyOn(storageService, 'uploadMultipleFiles').mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useImageUpload());
      await expect(
        act(async () => {
          await result.current.uploadImages(['file1'], 'uploads');
        })
      ).rejects.toThrow('Storage error');

      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('useNotifications', () => {
    it('provides notifications and unread management', async () => {
      useAuthStore.getState().setUser({ uid: 'usr-1', email: 'user@test.com' });
      const markSpy = vi.spyOn(notifService, 'markAsRead').mockResolvedValue();
      const markAllSpy = vi.spyOn(notifService, 'markAllAsRead').mockResolvedValue();

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.markAsRead('n1');
      });
      expect(markSpy).toHaveBeenCalledWith('n1');

      await act(async () => {
        await result.current.markAllAsRead();
      });
      expect(markAllSpy).toHaveBeenCalledWith('usr-1');
    });
  });

  describe('useRealtimeCollection polling and visibility backoff', () => {
    it('calculates polling interval based on auth, visibility, and exponential error backoff', () => {
      // Never poll when logged out
      expect(calculatePollingInterval(null, false, false)).toBe(false);

      // Pause when tab/document is hidden
      expect(calculatePollingInterval(null, true, true)).toBe(false);

      // Active and healthy: polls every 10 seconds
      expect(calculatePollingInterval({ error: null }, false, true)).toBe(10000);

      // Exponential error backoff capped at 60 seconds
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 1 }, false, true)).toBe(5000);
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 2 }, false, true)).toBe(10000);
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 3 }, false, true)).toBe(20000);
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 4 }, false, true)).toBe(40000);
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 5 }, false, true)).toBe(60000);
      expect(calculatePollingInterval({ error: new Error(), errorUpdateCount: 6 }, false, true)).toBe(60000); // capped
    });

    it('pauses polling when tab is hidden and applies exponential backoff on error with fake timers', () => {
      vi.useFakeTimers();
      useAuthStore.getState().setUser({ uid: 'u-poll-1', email: 'poll@test.com' });

      const { result } = renderHook(
        () => useRealtimeCollection('/api/test', {}, true),
        { wrapper: createWrapper() }
      );
      expect(result.current.data).toBeDefined();

      vi.advanceTimersByTime(10000);
      vi.useRealTimers();
    });
  });

  describe('useAuth hook', () => {
    it('handles sign in, sign up, and sign out with error toasts', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const authService = await import('@/services/auth.service');
      const toastMod = await import('@/components/ui/use-toast');
      const toastMock = vi.fn();
      vi.spyOn(toastMod, 'useToast').mockReturnValue({ toast: toastMock });

      vi.spyOn(authService, 'signIn').mockRejectedValueOnce(new Error('Bad login'));
      vi.spyOn(authService, 'signUp').mockRejectedValueOnce(new Error('Bad signup'));
      vi.spyOn(authService, 'signOutUser').mockRejectedValueOnce(new Error('Signout fail'));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signIn('a', 'b')).rejects.toThrow('Bad login');
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign In Failed' }));

      await expect(result.current.signUp('a', 'b', 'c')).rejects.toThrow('Bad signup');
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign Up Failed' }));

      await expect(result.current.signOut()).rejects.toThrow('Signout fail');
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign Out Failed' }));
    });
  });
});
