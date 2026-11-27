import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { LostFoundCard } from '../LostFoundCard';
import { renderWithProviders } from '@/test/utils';
import { LostFoundStatus, LostFoundType } from '@aniresq/shared-types';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

describe('LostFoundCard anonymous redaction & contact display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePost = {
    id: 'lf-test-1',
    reporterId: 'reporter-123',
    type: LostFoundType.LOST,
    status: LostFoundStatus.ACTIVE,
    title: 'Lost Golden Retriever Pup',
    species: 'DOG',
    breed: 'Golden Retriever',
    color: 'Golden',
    description: 'Wearing a red collar near the park.',
    lastSeenAddress: 'Central Park West',
    createdAt: new Date().toISOString(),
    photoUrls: [],
  };

  it('redacts contact number and displays "Sign in to view" link for anonymous users', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const anonymousPost = {
      ...basePost,
      contactPhone: null, // Redacted by backend for unauthenticated callers
    };

    renderWithProviders(<LostFoundCard post={anonymousPost} />);

    expect(screen.getByText('Direct Contact:')).toBeInTheDocument();
    const signInLink = screen.getByRole('link', { name: /sign in to view/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink.getAttribute('href')).toBe('/login');
    expect(screen.getByText(/protected/i)).toBeInTheDocument();
    expect(screen.queryByText('+1234567890')).not.toBeInTheDocument();
  });

  it('displays real phone number and clickable tel: link when authenticated', () => {
    useAuth.mockReturnValue({
      user: { uid: 'user-456', role: 'CITIZEN' },
      isAuthenticated: true,
    });

    const authenticatedPost = {
      ...basePost,
      contactPhone: '+1-555-0199',
    };

    renderWithProviders(<LostFoundCard post={authenticatedPost} />);

    expect(screen.getByText('Direct Contact:')).toBeInTheDocument();
    const phoneLink = screen.getByRole('link', { name: '+1-555-0199' });
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink.getAttribute('href')).toBe('tel:+1-555-0199');
    expect(screen.getByText(/verified contact/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to view/i })).not.toBeInTheDocument();
  });
});
