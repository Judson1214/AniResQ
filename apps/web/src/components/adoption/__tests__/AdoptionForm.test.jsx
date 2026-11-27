import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdoptionForm } from '../AdoptionForm';
import { renderWithProviders } from '@/test/utils';
import * as adoptionService from '@/services/adoption.service';
import * as toastModule from '@/components/ui/use-toast';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

describe('AdoptionForm validation and conflict handling', () => {
  const mockAnimal = {
    id: 'animal-uuid-1',
    name: 'Bella',
    breed: 'Labrador',
    ageEstimate: 2,
    photoUrls: ['https://example.com/bella.jpg'],
  };

  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toastModule, 'useToast').mockReturnValue({ toast: mockToast });
    useAuth.mockReturnValue({
      user: { uid: 'applicant-uuid-1', email: 'adopter@test.com' },
      isAuthenticated: true,
    });
  });

  it('renders initial step with animal information', () => {
    renderWithProviders(<AdoptionForm animal={mockAnimal} />);

    expect(screen.getByText('Adopting Bella')).toBeInTheDocument();
    expect(screen.getByText(/Living Situation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Environment Type/i)).toBeInTheDocument();
  });

  it('blocks step progression when step 1 validation fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdoptionForm animal={mockAnimal} />);

    // Click Next without selecting environmentType
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Should remain on step 1
    expect(screen.getByText(/Living Situation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Personal & Household/i)).not.toBeInTheDocument();
  });

  it('handles 409 conflict duplicate application with proper error toast', async () => {
    const user = userEvent.setup();
    const conflictError = {
      response: {
        status: 409,
        data: {
          detail: 'You already have an open adoption application for this animal.',
        },
      },
    };

    vi.spyOn(adoptionService, 'submitApplication').mockRejectedValueOnce(conflictError);

    renderWithProviders(<AdoptionForm animal={mockAnimal} />);

    // Fill Step 1
    await user.selectOptions(screen.getByLabelText(/Environment Type/i), 'apartment');
    await user.type(screen.getByLabelText(/Other Pets/i), 'None');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Verify Step 2
    expect(await screen.findByText(/Personal & Household/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Number of Family Members/i));
    await user.type(screen.getByLabelText(/Number of Family Members/i), '2');
    await user.type(screen.getByLabelText(/Work Schedule/i), 'Work from home full time');
    await user.type(screen.getByLabelText(/Prior Pet Experience/i), 'Had dogs for 10 years');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Verify Step 3
    expect(await screen.findByText(/Motivation/i)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/Why do you want to adopt/i),
      'We love animals and have a very welcoming home with plenty of time to care for Bella.'
    );
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Verify Step 4 (Review)
    expect(await screen.findByText(/Review Application/i)).toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: /submit application/i });
    await user.click(submitButton);

    // Verify 409 error toast handling
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Application Failed',
          description: 'You already have an open adoption application for this animal.',
          variant: 'destructive',
        })
      );
    });
  });

  it('handles successful application submission and back button', async () => {
    const user = userEvent.setup();
    vi.spyOn(adoptionService, 'submitApplication').mockResolvedValueOnce({ id: 'app-success-1' });

    renderWithProviders(<AdoptionForm animal={mockAnimal} />);

    // Step 1
    await user.selectOptions(screen.getByLabelText(/Environment Type/i), 'apartment');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Back button
    await screen.findByText(/Personal & Household/i);
    await user.click(screen.getByRole('button', { name: /previous|back/i }));
    expect(screen.getByText(/Living Situation/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 2
    await user.clear(screen.getByLabelText(/Number of Family Members/i));
    await user.type(screen.getByLabelText(/Number of Family Members/i), '2');
    await user.type(screen.getByLabelText(/Work Schedule/i), 'Work from home');
    await user.type(screen.getByLabelText(/Prior Pet Experience/i), 'Experienced owner');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 3
    await screen.findByText(/Motivation/i);
    await user.type(screen.getByLabelText(/Why do you want to adopt/i), 'Ready to give a great loving home forever.');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 4
    await screen.findByText(/Review Application/i);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Application Submitted',
        })
      );
    });
  });
});
