import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/utils';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import LostFoundPage from '@/pages/LostFoundPage';
import AdoptionPage from '@/pages/AdoptionPage';
import ReportRescuePage from '@/pages/ReportRescuePage';
import { LoginForm } from '@/components/auth/LoginForm';
import { LostFoundCard } from '@/components/lostfound/LostFoundCard';
import { LostFoundStatus, LostFoundType } from '@aniresq/shared-types';
import * as animalService from '@/services/animal.service';
import * as lostfoundService from '@/services/lostfound.service';

function createTestWrapper(initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

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

  it('LoginPage has no serious or critical accessibility violations', async () => {
    const Wrapper = createTestWrapper(['/login']);
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    const results = await axe(container);
    const criticalViolations = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact)
    );
    expect(criticalViolations).toEqual([]);
  });

  it('RegisterPage has no serious or critical accessibility violations', async () => {
    const Wrapper = createTestWrapper(['/register']);
    const { container } = render(<RegisterPage />, { wrapper: Wrapper });
    const results = await axe(container);
    const criticalViolations = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact)
    );
    expect(criticalViolations).toEqual([]);
  });

  it('LostFoundPage has no serious or critical accessibility violations', async () => {
    vi.spyOn(lostfoundService, 'getPosts').mockResolvedValue([
      {
        id: 'lf-1',
        reporterId: 'rep-1',
        type: LostFoundType.LOST,
        status: LostFoundStatus.ACTIVE,
        title: 'Missing Cat',
        species: 'CAT',
        breed: 'Tabby',
        color: 'Orange',
        description: 'Lost near park',
        lastSeenAddress: 'Main St',
        contactPhone: null,
        createdAt: new Date().toISOString(),
        photoUrls: [],
      },
    ]);
    const Wrapper = createTestWrapper(['/lost-found']);
    const { container } = render(<LostFoundPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Lost & Found' })).toBeInTheDocument();
    });
    const results = await axe(container);
    const criticalViolations = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact)
    );
    expect(criticalViolations).toEqual([]);
  });

  it('AdoptionPage has no serious or critical accessibility violations', async () => {
    vi.spyOn(animalService, 'getAnimalById').mockResolvedValue({
      id: 'an-1',
      name: 'Bella',
      species: 'DOG',
      breed: 'Labrador',
      gender: 'FEMALE',
      ageYears: 2,
      adoptionStatus: 'AVAILABLE',
      photoUrls: ['https://example.com/bella.jpg'],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/adopt/an-1']}>
          <Routes>
            <Route path="/adopt/:animalId" element={<AdoptionPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Adoption Application')).toBeInTheDocument();
    });

    const results = await axe(container);
    const criticalViolations = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact)
    );
    expect(criticalViolations).toEqual([]);
  });

  it('ReportRescuePage has no serious or critical accessibility violations', async () => {
    const Wrapper = createTestWrapper(['/report-rescue']);
    const { container } = render(<ReportRescuePage />, { wrapper: Wrapper });
    const results = await axe(container);
    const criticalViolations = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact)
    );
    expect(criticalViolations).toEqual([]);
  });
});
