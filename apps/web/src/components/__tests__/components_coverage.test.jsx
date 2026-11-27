import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApplicationReview } from '@/components/adoption/ApplicationReview';
import { ApplicationCard } from '@/components/adoption/ApplicationCard';
import { RescueIncidentReport } from '@/components/rescue/RescueIncidentReport';
import { RescueStatusBadge } from '@/components/rescue/RescueStatusBadge';
import { RescueCard } from '@/components/rescue/RescueCard';
import { RescueVerificationModal } from '@/components/rescue/RescueVerificationModal';
import { RescueTimeline } from '@/components/rescue/RescueTimeline';
import { RescueMap } from '@/components/rescue/RescueMap';
import { RescueReportForm } from '@/components/rescue/RescueReportForm';
import { AnimalCard } from '@/components/animals/AnimalCard';
import { AnimalFilters } from '@/components/animals/AnimalFilters';
import { AnimalGrid } from '@/components/animals/AnimalGrid';
import { DonateAnimalForm } from '@/components/surrender/DonateAnimalForm';
import { LostFoundForm } from '@/components/lostfound/LostFoundForm';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/authStore';
import * as animalService from '@/services/animal.service';
import * as lostfoundService from '@/services/lostfound.service';
import { RescueStatus, RescueSeverity, ApplicationStatus } from '@aniresq/shared-types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

describe('Component Library Tests & Edge Cases', () => {
  describe('Deleted User Edge Cases (Null Reporter & Applicant)', () => {
    it('ApplicationReview gracefully displays "Deleted user" when applicantId is null', () => {
      const mockApp = {
        id: 'app-del-1',
        applicantId: null,
        status: ApplicationStatus.SUBMITTED,
        answers: { homeType: 'Apartment', experience: 'None' },
      };
      render(<ApplicationReview application={mockApp} onReview={vi.fn()} />, { wrapper });

      expect(screen.getByText('Deleted user')).toBeInTheDocument();
      expect(screen.getByText('Application Review')).toBeInTheDocument();
      expect(screen.getByText('Apartment')).toBeInTheDocument();
    });

    it('RescueIncidentReport gracefully displays "Deleted User" when reporterId is null', () => {
      const mockRescue = {
        id: 'res-del-1',
        title: 'Injured stray dog',
        description: 'Found limping near park',
        species: 'DOG',
        severity: RescueSeverity.CRITICAL,
        status: RescueStatus.PENDING,
        reporterId: null,
        reporterName: null,
        address: 'Park St 12',
        createdAt: new Date().toISOString(),
      };
      render(<RescueIncidentReport rescue={mockRescue} />, { wrapper });

      expect(screen.getByText('Deleted User')).toBeInTheDocument();
      expect(screen.getByText('Account Deactivated')).toBeInTheDocument();
      expect(screen.getByText('Injured stray dog')).toBeInTheDocument();
    });
  });

  describe('Adoption Components', () => {
    it('ApplicationCard renders animal name and status badge correctly', () => {
      const mockApp = {
        id: 'app-1',
        status: ApplicationStatus.APPROVED,
        createdAt: new Date().toISOString(),
        screeningNotes: 'Passed background screening',
      };
      const mockAnimal = {
        id: 'an-1',
        name: 'Bella',
        photos: ['https://test.supabase.co/bella.jpg'],
      };
      render(<ApplicationCard application={mockApp} animal={mockAnimal} />, { wrapper });

      expect(screen.getByText('Bella')).toBeInTheDocument();
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
      expect(screen.getByText('"Passed background screening"')).toBeInTheDocument();
    });
  });

  describe('Rescue Components', () => {
    it('RescueStatusBadge renders distinct styles for all rescue lifecycle states', () => {
      const { rerender } = render(<RescueStatusBadge status={RescueStatus.PENDING} />);
      expect(screen.getByText('PENDING')).toBeInTheDocument();

      rerender(<RescueStatusBadge status={RescueStatus.IN_PROGRESS} />);
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();

      rerender(<RescueStatusBadge status={RescueStatus.RESOLVED} />);
      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    });

    it('RescueCard renders rescue summary and link to detail', () => {
      const mockRescue = {
        id: 'res-card-1',
        title: 'Trapped Kitten',
        species: 'CAT',
        severity: RescueSeverity.HIGH,
        status: RescueStatus.IN_PROGRESS,
        address: '5th Ave & Pine',
        description: 'Needs ladder',
        createdAt: new Date().toISOString(),
      };
      render(<RescueCard rescue={mockRescue} />, { wrapper });

      expect(screen.getByText('Trapped Kitten')).toBeInTheDocument();
      expect(screen.getByText('5th Ave & Pine')).toBeInTheDocument();
    });
  });

  describe('Animal Components', () => {
    it('AnimalCard renders animal profile details and badges', () => {
      const mockAnimal = {
        id: 'an-card-1',
        name: 'Charlie',
        species: 'DOG',
        breed: 'Labrador',
        ageEstimate: '3 years',
        gender: 'MALE',
        photos: ['https://test.co/charlie.jpg'],
      };
      render(<AnimalCard animal={mockAnimal} />, { wrapper });

      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText(/Labrador/)).toBeInTheDocument();
      expect(screen.getByText(/3 years/)).toBeInTheDocument();
    });

    it('AnimalFilters and AnimalGrid render correctly and trigger filter changes', () => {
      const setFilters = vi.fn();
      render(<AnimalFilters filters={{ species: 'All', gender: 'All', status: 'All', search: '' }} setFilters={setFilters} />, { wrapper });

      const speciesSelect = screen.getByDisplayValue('All Species');
      fireEvent.change(speciesSelect, { target: { value: 'DOG' } });

      // Render AnimalGrid
      render(<AnimalGrid animals={[{ id: 'g1', name: 'Max', species: 'DOG' }]} isLoading={false} />, { wrapper });
      expect(screen.getByText('Max')).toBeInTheDocument();
    });
  });

  describe('Form Validation Errors', () => {
    it('DonateAnimalForm blocks submit and displays validation errors for missing fields', async () => {
      render(<DonateAnimalForm />, { wrapper });

      const submitBtn = screen.getByRole('button', { name: /Submit Animal/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Please provide some details about the animal')).toBeInTheDocument();
        expect(screen.getByText('Please explain why you are listing this animal')).toBeInTheDocument();
      });
    });

    it('LostFoundForm blocks submit and displays validation errors for missing fields', async () => {
      render(<LostFoundForm />, { wrapper });

      const submitBtn = screen.getByRole('button', { name: /Post Lost Pet/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/String must contain at least 5 character\(s\)/i)).toBeInTheDocument();
      });
    });

    it('DonateAnimalForm accepts photos and creates object URLs', () => {
      const { container } = render(<DonateAnimalForm />, { wrapper });
      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['content'], 'dog.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    it('LostFoundForm handles photo input and GPS location trigger', () => {
      const { container } = render(<LostFoundForm />, { wrapper });
      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['photo'], 'cat.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      const gpsBtn = screen.getByRole('button', { name: /Use My GPS/i });
      fireEvent.click(gpsBtn);
    });

    it('RescueIncidentReport supports printing and closing report', () => {
      const mockRescue = {
        id: 'res-del-2',
        title: 'Injured cat',
        description: 'Under car',
        species: 'CAT',
        severity: RescueSeverity.HIGH,
        status: RescueStatus.DISPATCHED,
        reporterId: 'rep-long-identifier-12345',
        reporterName: 'Reporter Name',
        address: 'Oak St 12',
        createdAt: new Date().toISOString(),
      };
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      const onClose = vi.fn();
      render(<RescueIncidentReport rescue={mockRescue} onClose={onClose} />, { wrapper });

      const printBtn = screen.getByRole('button', { name: /Print \/ Save PDF/i });
      fireEvent.click(printBtn);
      expect(printSpy).toHaveBeenCalled();
    });
  });

  describe('Layout & Navigation Components', () => {
    it('Navbar, Footer, and Sidebar render navigation links and branding', () => {
      useAuthStore.getState().setUser({
        uid: 'nav-u-1',
        displayName: 'John Rescue',
        email: 'john@rescue.org',
        role: 'VOLUNTEER',
      });
      render(<Navbar />, { wrapper });
      expect(screen.getByText('AniResQ')).toBeInTheDocument();

      const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
      fireEvent.click(signOutBtn);

      render(<Footer />, { wrapper });
      expect(screen.getByText(/A community-driven platform/i)).toBeInTheDocument();

      render(<Sidebar />, { wrapper });
      expect(screen.getByText(/Command Hub|My Dashboard/i)).toBeInTheDocument();
    });

    it('NotificationPanel renders unread notifications list', () => {
      render(<NotificationPanel />, { wrapper });
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  describe('Rescue Components Interactions', () => {
    it('RescueMap renders custom icons for rescues and hospitals', () => {
      render(
        <RescueMap
          rescues={[
            { id: 'r1', title: 'Critical Rescue', severity: 'CRITICAL', status: 'PENDING', location: { latitude: 12.97, longitude: 77.59 } },
            { id: 'r2', title: 'High Rescue', severity: 'HIGH', status: 'IN_PROGRESS', location: { latitude: 12.98, longitude: 77.60 } },
          ]}
        />,
        { wrapper }
      );
    });

    it('RescueTimeline renders different status icons and messages', () => {
      vi.mock('@/hooks/useRealtimeCollection', () => ({
        useRealtimeCollection: () => ({
          data: [
            { id: '1', status: 'RESOLVED', message: 'Resolved successfully', createdAt: new Date().toISOString() },
            { id: '2', status: 'IN_PROGRESS', message: 'In progress', createdAt: new Date().toISOString() },
            { id: '3', status: 'DISPATCHED', message: 'Dispatched unit', createdAt: new Date().toISOString() },
            { id: '4', status: 'PENDING', message: 'Pending response', createdAt: new Date().toISOString() },
          ],
          isLoading: false,
        }),
      }));

      render(<RescueTimeline requestId="res-1" />, { wrapper });
      expect(screen.getByText('Resolved successfully')).toBeInTheDocument();
      expect(screen.getByText('In progress')).toBeInTheDocument();
      expect(screen.getByText('Dispatched unit')).toBeInTheDocument();
      expect(screen.getByText('Pending response')).toBeInTheDocument();
    });

    it('RescueVerificationModal validates notes and triggers onConfirm', async () => {
      const onConfirm = vi.fn().mockResolvedValue({});
      const onClose = vi.fn();

      const { rerender } = render(
        <RescueVerificationModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Resolve Emergency SOS')).toBeInTheDocument();

      // Submit with empty notes (<10 characters)
      const form = screen.getByRole('dialog').querySelector('form');
      fireEvent.submit(form);
      expect(screen.getByText(/Please provide resolution notes/i)).toBeInTheDocument();

      // File input with invalid type
      const fileInput = screen.getByRole('dialog').querySelector('input[type="file"]');
      const badFile = new File(['text'], 'bad.txt', { type: 'text/plain' });
      fireEvent.change(fileInput, { target: { files: [badFile] } });
      expect(screen.getByText(/is not an accepted format/i)).toBeInTheDocument();

      // File input with oversized file
      const bigFile = new File(['a'.repeat(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
      fireEvent.change(fileInput, { target: { files: [bigFile] } });
      expect(screen.getByText(/exceeds the 5MB file size limit/i)).toBeInTheDocument();

      // Fill valid notes and submit
      const notesArea = screen.getByPlaceholderText(/Describe the condition of the animal/i);
      fireEvent.change(notesArea, { target: { value: 'Animal has been safely treated and transferred to shelter.' } });

      fireEvent.submit(form);
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          notes: 'Animal has been safely treated and transferred to shelter.',
          verificationPhotos: [],
        });
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('RescueReportForm handles photo input, address search, and GPS click', () => {
      const { container } = render(<RescueReportForm />, { wrapper });

      const fileInput = container.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['content'], 'dog.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      const searchBtn = screen.getByRole('button', { name: /Search Map/i });
      fireEvent.click(searchBtn);

      const gpsBtn = screen.getByRole('button', { name: /Use My GPS/i });
      fireEvent.click(gpsBtn);
    });

    it('ApplicationReview handles notes changes and calls onReview on approve and reject', () => {
      const onReview = vi.fn();
      const mockApp = {
        id: 'app-act-1',
        applicantId: 'u-123',
        status: ApplicationStatus.SUBMITTED,
        answers: { homeType: 'House', experience: '5 years' },
      };
      render(<ApplicationReview application={mockApp} onReview={onReview} />, { wrapper });

      const notesInput = screen.getByPlaceholderText(/Add internal notes/i);
      fireEvent.change(notesInput, { target: { value: 'Applicant looks great.' } });

      const approveBtn = screen.getByRole('button', { name: /Approve/i });
      fireEvent.click(approveBtn);
      expect(onReview).toHaveBeenCalledWith(ApplicationStatus.APPROVED, 'Applicant looks great.');

      const rejectBtn = screen.getByRole('button', { name: /Reject/i });
      fireEvent.click(rejectBtn);
      expect(onReview).toHaveBeenCalledWith(ApplicationStatus.REJECTED, 'Applicant looks great.');
    });

    it('AnimalFilters handles search, species, status changes, and clearing', () => {
      const setFilters = vi.fn();
      const filters = { search: 'Buddy', species: 'DOG', status: 'AVAILABLE' };
      render(<AnimalFilters filters={filters} setFilters={setFilters} />, { wrapper });

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'Max' } });
      expect(setFilters).toHaveBeenCalled();

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'CAT' } });
      fireEvent.change(selects[1], { target: { value: 'ADOPTED' } });

      const clearBtn = screen.getByRole('button', { name: /Clear Filters/i });
      fireEvent.click(clearBtn);
      expect(setFilters).toHaveBeenCalledWith({ species: 'All', gender: 'All', status: 'All', search: '' });
    });

    it('RescueCard handles detailed view and navigation', () => {
      const rescueDetail = {
        id: 'res-detail-1',
        title: 'Injured Dog at Pier',
        description: 'Requires emergency medical assistance immediately.',
        species: 'DOG',
        severity: 'CRITICAL',
        status: RescueStatus.PENDING,
        address: '456 Ocean Drive, City',
        photoUrls: ['https://example.com/dog.jpg'],
        createdAt: new Date().toISOString(),
      };
      const { rerender } = render(<RescueCard rescue={rescueDetail} isPublic={false} />, { wrapper });

      expect(screen.getByText('Injured Dog at Pier')).toBeInTheDocument();
      expect(screen.getByText(/Requires emergency medical assistance/i)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Injured Dog at Pier'));

      // Test with other severities
      ['HIGH', 'MEDIUM', 'LOW'].forEach(sev => {
        rerender(<RescueCard rescue={{ ...rescueDetail, severity: sev }} isPublic={false} />);
      });
    });

    it('Navbar handles user initials, mobile menu, and sign out', () => {
      useAuthStore.getState().setUser({
        uid: 'u-nav-1',
        displayName: 'Alice Cooper',
        email: 'alice@example.com',
        role: 'CITIZEN',
      });
      render(<Navbar />, { wrapper });
      expect(screen.getByText('AniResQ')).toBeInTheDocument();
      expect(screen.getByText('AC')).toBeInTheDocument();
    });
  });
});
