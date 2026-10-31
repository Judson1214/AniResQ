import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/config/supabase';
import { getUserProfile, updateUserProfile } from '../auth.service';

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

  it('updateUserProfile excludes role to prevent privilege escalation', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({ data: { id: 'user-1' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    supabase.from.mockReturnValue({ update: updateMock });

    await updateUserProfile('user-1', {
      displayName: 'New Name',
      role: 'ADMIN', // Should be strictly ignored!
      phone: '9876543210',
    });

    // Verify role was stripped from db payload
    expect(updateMock).toHaveBeenCalledWith({
      display_name: 'New Name',
      phone: '9876543210',
    });
  });
});
