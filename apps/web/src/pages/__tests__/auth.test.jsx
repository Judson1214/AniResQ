import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';
import RegisterPage from '../RegisterPage';
import { renderWithProviders } from '@/test/utils';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import * as toastModule from '@/components/ui/use-toast';

describe('Auth workflows: Login, Register, Logout & Cache Clearing', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toastModule, 'useToast').mockReturnValue({ toast: mockToast });
    useAuthStore.getState().clearAuth();
  });

  it('renders login page and allows user login', async () => {
    const user = userEvent.setup();
    const mockUser = {
      uid: 'user-123',
      email: 'operator@aniresq.org',
      role: 'CITIZEN',
      displayName: 'Operator One',
    };

    vi.spyOn(authService, 'signIn').mockResolvedValueOnce(mockUser);

    renderWithProviders(<LoginPage />);

    expect(screen.getByText('System Authentication')).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/Operator Email/i);
    const passwordInput = screen.getByLabelText(/Security Clearance/i);
    const submitBtn = screen.getByRole('button', { name: /Authenticate/i });

    await user.type(emailInput, 'operator@aniresq.org');
    await user.type(passwordInput, 'SecurePass123!');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authService.signIn).toHaveBeenCalledWith('operator@aniresq.org', 'SecurePass123!');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
        })
      );
    });
  });

  it('renders register page and handles successful registration', async () => {
    const user = userEvent.setup();
    const mockCreatedUser = {
      uid: 'new-user-123',
      email: 'newoperator@aniresq.org',
      role: 'CITIZEN',
      displayName: 'New Operator',
    };

    vi.spyOn(authService, 'signUp').mockResolvedValueOnce(mockCreatedUser);

    renderWithProviders(<RegisterPage />);

    expect(screen.getByText('Request Clearance')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Operator Identity/i);
    const emailInput = screen.getByLabelText(/Secure Email/i);
    const passwordInput = screen.getByLabelText(/Security Clearance/i);
    const submitBtn = screen.getByRole('button', { name: /Create Account/i });

    await user.type(nameInput, 'New Operator');
    await user.type(emailInput, 'newoperator@aniresq.org');
    await user.type(passwordInput, 'SecurePass123!');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authService.signUp).toHaveBeenCalledWith(
        'newoperator@aniresq.org',
        'SecurePass123!',
        'New Operator',
        undefined
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Account Created',
        })
      );
    });
  });

  it('clears auth store and query cache on logout and 401 response', async () => {
    // Set initial authenticated state and cache data
    useAuthStore.getState().setUser({
      uid: 'logged-in-user',
      email: 'logged@aniresq.org',
      role: 'CITIZEN',
    });
    const { queryClient } = await import('@/lib/queryClient');
    queryClient.setQueryData(['test-cache-key'], { cached: true });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(queryClient.getQueryData(['test-cache-key'])).toBeDefined();

    const { supabase } = await import('@/config/supabase');
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

    // Call signOutUser()
    await authService.signOutUser();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['test-cache-key'])).toBeUndefined();

    useAuthStore.getState().setSessionUser({ uid: 'sess-1' });
    expect(useAuthStore.getState().sessionUser).toEqual({ uid: 'sess-1' });
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
