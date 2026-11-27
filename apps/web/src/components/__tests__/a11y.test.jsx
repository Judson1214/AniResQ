import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/utils';
import { LoginForm } from '@/components/auth/LoginForm';
import { LostFoundCard } from '@/components/lostfound/LostFoundCard';
import { LostFoundStatus, LostFoundType } from '@aniresq/shared-types';

describe('Accessibility (a11y) tests with vitest-axe', () => {
  it('LoginForm has no accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LostFoundCard has no critical accessibility violations', async () => {
    const post = {
      id: 'lf-a11y-1',
      reporterId: 'rep-1',
      type: LostFoundType.LOST,
      status: LostFoundStatus.ACTIVE,
      title: 'Friendly Golden Retriever',
      species: 'DOG',
      breed: 'Golden Retriever',
      color: 'Golden',
      description: 'Lost in park',
      lastSeenAddress: 'Central Park West',
      contactPhone: null,
      createdAt: new Date().toISOString(),
      photoUrls: ['https://example.com/dog.jpg'],
    };

    const { container } = renderWithProviders(<LostFoundCard post={post} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
