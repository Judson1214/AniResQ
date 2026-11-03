import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/config/supabase';
import api from '@/lib/api';
import { getUserProfile, updateUserProfile, signUp } from '../auth.service';

vi.mock('@/lib/api', () => ({
  default: {
    patch: vi.fn(),
  },
}));

vi.mock('@/config/supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserProfile fetches and formats profile', async () => {
    const mockDbUser = {
      id: 'user-1',
      email: 'user@example.com',
      display_name: 'Jane Doe',
      role: 'CITIZEN',
      phone: '1234567890',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2026-10-31T00:00:00Z',
    };

    const singleMock = vi.fn().mockResolvedValueOnce({ data: mockDbUser, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    supabase.from.mockReturnValue({ select: selectMock });

    const profile = await getUserProfile('user-1');
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(profile).toEqual({
      uid: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Jane Doe',
      role: 'CITIZEN',
      phone: '1234567890',
      avatarUrl: 'https://example.com/avatar.jpg',
      isVerified: false,
      createdAt: '2026-10-31T00:00:00Z',
    });
  });

  it('updateUserProfile routes through API and excludes role to prevent privilege escalation', async () => {
    api.patch.mockResolvedValueOnce({ data: { id: 'user-1', displayName: 'New Name' } });

    await updateUserProfile('user-1', {
      displayName: 'New Name',
      role: 'ADMIN', // Should be strictly ignored!
      phone: '9876543210',
      avatarUrl: 'https://cspnzitnvzdwwyxpnluw.supabase.co/storage/v1/object/public/uploads/avatar.jpg'
    });

    // Verify role was stripped and routed through backend PATCH /api/users/user-1
    expect(api.patch).toHaveBeenCalledWith('/users/user-1', {
      displayName: 'New Name',
      phoneNumber: '9876543210',
      phone: '9876543210',
      avatarUrl: 'https://cspnzitnvzdwwyxpnluw.supabase.co/storage/v1/object/public/uploads/avatar.jpg'
    });
  });

  it('signUp disallows requesting ADMIN role in metadata', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-id', email: 'test@example.com' } },
      error: null
    });

    await signUp('test@example.com', 'Password123!', 'Test User', 'ADMIN');

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!',
      options: {
        data: {
          display_name: 'Test User',
          phone: '',
          requested_role: null, // Sanitized away from ADMIN
        }
      }
    });
  });
});
