import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@aniresq/shared-types';
import api from '@/lib/api';
import * as toastModule from '@/components/ui/use-toast';
import * as authService from '@/services/auth.service';
import * as userService from '@/services/user.service';
import * as rescueService from '@/services/rescue.service';
import * as lostFoundService from '@/services/lostfound.service';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivacyPage from '../PrivacyPage';
import TermsPage from '../TermsPage';
import SafetyPage from '../SafetyPage';
import ContactPage from '../ContactPage';
import RegisterPage from '../RegisterPage';
import ProfilePage from '../ProfilePage';
import AdminReportsPage from '../AdminReportsPage';
import OperatorRegistryPage from '../OperatorRegistryPage';
import RescueDetailPage from '../RescueDetailPage';
import { LostFoundCard } from '@/components/lostfound/LostFoundCard';
import { ReportContentModal } from '@/components/common/ReportContentModal';

describe('Frontend Pilot Features Test Suite', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toastModule, 'useToast').mockReturnValue({ toast: mockToast, toasts: [] });
    useAuthStore.getState().clearAuth();
  });

  describe('1. Legal & Safety Pages with Template Banner', () => {
    it('renders PrivacyPage with TEMPLATE banner and minimization content', () => {
      renderWithProviders(<PrivacyPage />);
      expect(screen.getByRole('heading', { name: /Privacy Policy/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/Commitment to Data Minimization/i)).toBeInTheDocument();
      expect(screen.getByText(/TEMPLATE: must be reviewed by a qualified lawyer before launch/i)).toBeInTheDocument();
    });

    it('renders TermsPage with TEMPLATE banner and emergency disclaimer', () => {
      renderWithProviders(<TermsPage />);
      expect(screen.getByRole('heading', { name: /Terms of Service/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/Important Emergency Disclaimer/i)).toBeInTheDocument();
      expect(screen.getByText(/TEMPLATE: must be reviewed by a qualified lawyer before launch/i)).toBeInTheDocument();
    });

    it('renders SafetyPage with emergency and handling protocols', () => {
      renderWithProviders(<SafetyPage />);
      expect(screen.getByText(/Safety Protocols & Guidelines/i)).toBeInTheDocument();
      expect(screen.getByText(/Rabies Warning/i)).toBeInTheDocument();
      expect(screen.getByText(/Adoption Scam & Fraud Prevention/i)).toBeInTheDocument();
    });

    it('renders ContactPage with support details and links', () => {
      renderWithProviders(<ContactPage />);
      expect(screen.getByText(/Contact & Support/i)).toBeInTheDocument();
      expect(screen.getByText(/General Inquiries & Pilot Feedback/i)).toBeInTheDocument();
      expect(screen.getByText(/Abuse, Fraud & Safety Reports/i)).toBeInTheDocument();
    });
  });

  describe('2. Registration Terms & Consent Checkbox', () => {
    it('blocks registration when terms checkbox is unchecked', async () => {
      const user = userEvent.setup();
      const signUpSpy = vi.spyOn(authService, 'signUp').mockResolvedValue({});
      renderWithProviders(<RegisterPage />);

      const nameInput = screen.getByLabelText(/Operator Identity/i);
      const emailInput = screen.getByLabelText(/Secure Email/i);
      const passwordInput = screen.getByLabelText(/Security Clearance/i);
      const submitBtn = screen.getByRole('button', { name: /Create Account/i });

      await user.type(nameInput, 'Test Citizen');
      await user.type(emailInput, 'citizen@test.com');
      await user.type(passwordInput, 'ValidPass123!');

      // Do NOT check the terms checkbox
      await user.click(submitBtn);

      expect(screen.getByText(/You must accept the Terms of Service and Privacy Policy/i)).toBeInTheDocument();
      expect(signUpSpy).not.toHaveBeenCalled();
    });

    it('allows registration and records consent when checkbox is checked', async () => {
      const user = userEvent.setup();
      vi.spyOn(authService, 'signUp').mockResolvedValue({
        uid: 'user-consent-1',
        email: 'consent@test.com',
        displayName: 'Consenting User',
        role: 'CITIZEN',
      });
      const consentSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { termsVersion: '2026-11-27' } });

      renderWithProviders(<RegisterPage />);

      const nameInput = screen.getByLabelText(/Operator Identity/i);
      const emailInput = screen.getByLabelText(/Secure Email/i);
      const passwordInput = screen.getByLabelText(/Security Clearance/i);
      const checkbox = screen.getByLabelText(/I agree to the/i);
      const submitBtn = screen.getByRole('button', { name: /Create Account/i });

      await user.type(nameInput, 'Consenting User');
      await user.type(emailInput, 'consent@test.com');
      await user.type(passwordInput, 'ValidPass123!');
      await user.click(checkbox);
      await user.click(submitBtn);

      await waitFor(() => {
        expect(authService.signUp).toHaveBeenCalledWith('consent@test.com', 'ValidPass123!', 'Consenting User', undefined);
        expect(consentSpy).toHaveBeenCalledWith('/users/me/consent', { termsVersion: '2026-11-27' });
      });
    });
  });

  describe('3. Profile Page: ID Minimization, Export & Account Deletion', () => {
    beforeEach(() => {
      useAuthStore.getState().setUser({
        uid: 'user-prof-1',
        id: 'user-prof-1',
        email: 'prof@test.com',
        displayName: 'Profile User',
        role: UserRole.CITIZEN,
        requestedRole: null,
      });
    });

    it('ID clearance input enforces 4-char limit and submits requestClearance', async () => {
      const user = userEvent.setup();
      const clearanceSpy = vi.spyOn(userService, 'requestClearance').mockResolvedValue({ requestedRole: 'VOLUNTEER' });

      renderWithProviders(<ProfilePage />);

      const idInput = screen.getByLabelText(/Last 4 Characters of ID \/ License/i);
      expect(idInput).toHaveAttribute('maxLength', '4');
      expect(idInput).toHaveAttribute('placeholder', 'e.g. 1234');
      expect(screen.getByText(/Full ID numbers are never stored in our database/i)).toBeInTheDocument();

      await user.type(idInput, '9876');
      const submitBtn = screen.getByRole('button', { name: /Submit Clearance Request/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(clearanceSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            idCardNumber: '9876',
            idCardLast4: '9876',
            requestedRole: 'VOLUNTEER',
          })
        );
      });
    });

    it('downloads data export when Download JSON is clicked', async () => {
      const user = userEvent.setup();
      const mockExportData = {
        exportDate: '2026-11-27T00:00:00Z',
        profile: { id: 'user-prof-1', email: 'prof@test.com' },
        rescues: [],
        lostAndFoundPosts: [],
      };
      vi.spyOn(api, 'get').mockResolvedValue({ data: mockExportData });

      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      renderWithProviders(<ProfilePage />);

      const exportBtn = screen.getByRole('button', { name: /Download JSON/i });
      await user.click(exportBtn);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users/me/export');
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Data Archive Downloaded',
          })
        );
      });
    });

    it('handles delete account dialog cancellation and confirmation', async () => {
      const user = userEvent.setup();
      const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({});

      renderWithProviders(<ProfilePage />);

      const openDeleteBtn = screen.getByRole('button', { name: /Delete Account/i });
      await user.click(openDeleteBtn);

      expect(screen.getByText(/Permanent Account Deletion/i)).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
      await user.click(cancelBtn);

      // Re-open and confirm
      await user.click(openDeleteBtn);
      const confirmInput = screen.getByPlaceholderText('DELETE MY ACCOUNT');
      const deleteConfirmBtn = screen.getByRole('button', { name: /Permanently Delete/i });

      await user.type(confirmInput, 'DELETE MY ACCOUNT');
      await user.click(deleteConfirmBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('/users/me', { data: { confirm: 'DELETE MY ACCOUNT' } });
      });
    });

    it('handles withdrawing a pending clearance request', async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setUser({
        uid: 'user-pending-1',
        id: 'user-pending-1',
        email: 'pending@test.com',
        displayName: 'Pending User',
        role: UserRole.CITIZEN,
        requestedRole: 'VOLUNTEER',
      });
      const withdrawSpy = vi.spyOn(userService, 'withdrawClearance').mockResolvedValue({});

      renderWithProviders(<ProfilePage />);

      const withdrawBtn = screen.getByRole('button', { name: /Withdraw Request/i });
      await user.click(withdrawBtn);

      await waitFor(() => {
        expect(withdrawSpy).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Clearance Request Withdrawn',
          })
        );
      });
    });
  });

  describe('4. Report Content Modal', () => {
    it('submits report with reason and details', async () => {
      const user = userEvent.setup();
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { status: 'OPEN' } });
      const onClose = vi.fn();

      renderWithProviders(
        <ReportContentModal
          isOpen={true}
          onClose={onClose}
          targetType="LOST_FOUND"
          targetId="post-123"
          targetTitle="Lost Dog"
        />
      );

      expect(screen.getByText(/Report Lost Dog/i)).toBeInTheDocument();

      const reasonSelect = screen.getByLabelText(/Reason for Report/i);
      await user.selectOptions(reasonSelect, 'ABUSE');

      const detailsInput = screen.getByLabelText(/Additional Details/i);
      await user.type(detailsInput, 'Suspected animal abuse in photo');

      const submitBtn = screen.getByRole('button', { name: /Submit Report/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/reports', {
          targetType: 'LOST_FOUND',
          targetId: 'post-123',
          reason: 'ABUSE',
          details: 'Suspected animal abuse in photo',
        });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('5. Admin Reports Page Filters and Transitions', () => {
    it('blocks access for non-admin users', () => {
      useAuthStore.getState().setUser({
        uid: 'cit-1',
        email: 'cit@test.com',
        role: UserRole.CITIZEN,
      });

      renderWithProviders(<AdminReportsPage />);
      expect(screen.getByText(/Unauthorized Access/i)).toBeInTheDocument();
    });

    it('filters reports and handles Review, Action, and Dismiss transitions', async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setUser({
        uid: 'adm-1',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      });

      const mockReports = [
        {
          id: 'rep-1',
          targetType: 'RESCUE',
          targetId: 'res-999',
          reason: 'SPAM',
          details: 'Spam incident report',
          status: 'OPEN',
          createdAt: '2026-11-27T10:00:00Z',
        },
      ];

      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockReports });
      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: { status: 'REVIEWED' } });

      renderWithProviders(<AdminReportsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Spam incident report/i)).toBeInTheDocument();
      });

      // Status filters
      const allFilterBtn = screen.getByRole('button', { name: /^ALL$/i });
      await user.click(allFilterBtn);
      expect(getSpy).toHaveBeenCalledWith('/reports');

      const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
      await user.click(refreshBtn);

      // Moderation action buttons
      const reviewBtn = screen.getByTitle('Mark as Reviewed');
      await user.click(reviewBtn);
      expect(patchSpy).toHaveBeenCalledWith('/reports/rep-1', { status: 'REVIEWED' });

      const dismissBtn = screen.getByTitle('Dismiss Report');
      await user.click(dismissBtn);
      expect(patchSpy).toHaveBeenCalledWith('/reports/rep-1', { status: 'DISMISSED' });
    });
  });

  describe('6. Operator Registry Disable/Enable Buttons & Confirm Modal', () => {
    it('renders disable and enable actions with confirm dialog', async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setUser({
        uid: 'adm-1',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      });

      vi.spyOn(userService, 'getUsers').mockResolvedValue([
        {
          id: 'op-active',
          displayName: 'Active Operator',
          email: 'active@op.org',
          role: 'VOLUNTEER',
          isDisabled: false,
          idCardLast4: '5566',
        },
        {
          id: 'op-disabled',
          displayName: 'Disabled Operator',
          email: 'disabled@op.org',
          role: 'VOLUNTEER',
          isDisabled: true,
          idCardLast4: '7788',
        },
      ]);

      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { message: 'OK' } });

      renderWithProviders(<OperatorRegistryPage />);

      await waitFor(() => {
        expect(screen.getByText('Active Operator')).toBeInTheDocument();
        expect(screen.getByText('Disabled Operator')).toBeInTheDocument();
        expect(screen.getByText(/Ending in: 5566/i)).toBeInTheDocument();
        expect(screen.getByText('DISABLED')).toBeInTheDocument();
      });

      // Disable active operator
      const disableBtn = screen.getByRole('button', { name: /^Disable$/i });
      await user.click(disableBtn);

      expect(screen.getByText(/Disable Account\?/i)).toBeInTheDocument();

      // Cancel button test
      const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
      await user.click(cancelBtn);

      // Re-click and confirm
      await user.click(disableBtn);
      const confirmDisableBtn = screen.getByRole('button', { name: /Confirm Disable/i });
      await user.click(confirmDisableBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/users/op-active/disable');
      });

      // Enable disabled operator
      const enableBtn = screen.getByRole('button', { name: /^Enable$/i });
      await user.click(enableBtn);

      expect(screen.getByText(/Enable Account\?/i)).toBeInTheDocument();
      const confirmEnableBtn = screen.getByRole('button', { name: /Confirm Enable/i });
      await user.click(confirmEnableBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/users/op-disabled/enable');
      });
    });
  });

  describe('7. Report Incident on RescueDetailPage & LostFoundCard', () => {
    it('opens ReportContentModal from RescueDetailPage', async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setUser({
        uid: 'user-rescue-rep',
        email: 'rescuer@test.com',
        role: UserRole.CITIZEN,
      });

      vi.spyOn(rescueService, 'getRescueRequestById').mockResolvedValue({
        id: 'rescue-report-test',
        title: 'Puppy stuck in drain',
        status: 'PENDING',
        species: 'DOG',
        createdAt: '2026-11-27T00:00:00Z',
      });
      vi.spyOn(rescueService, 'getRescueTimeline').mockResolvedValue([]);

      render(<RescueDetailPage />, {
        wrapper: ({ children }) => {
          const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
          return (
            <QueryClientProvider client={qc}>
              <MemoryRouter initialEntries={['/rescue/rescue-report-test']}>
                <Routes>
                  <Route path="/rescue/:id" element={children} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          );
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Puppy stuck in drain')).toBeInTheDocument();
      });

      const reportIncidentBtn = screen.getByRole('button', { name: /Report Incident/i });
      await user.click(reportIncidentBtn);

      expect(screen.getByText(/Report Puppy stuck in drain/i)).toBeInTheDocument();
    });

    it('opens ReportContentModal from LostFoundCard', async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setUser({
        uid: 'user-lf-1',
        email: 'userlf@test.com',
        role: UserRole.CITIZEN,
      });

      const mockPost = {
        id: 'post-lf-1',
        title: 'Lost Golden Retriever',
        species: 'DOG',
        breed: 'Golden',
        color: 'Golden',
        description: 'Friendly dog lost near mall',
        status: 'ACTIVE',
        type: 'LOST',
        reporterId: 'someone-else',
        lastSeenAddress: 'MG Road',
        createdAt: '2026-11-27T00:00:00Z',
      };

      vi.spyOn(lostFoundService, 'getReplies').mockResolvedValue([
        {
          id: 'rep-lf-1',
          userName: 'Helpful Citizen',
          text: 'Saw him heading towards park',
          createdAt: '2026-11-27T01:00:00Z',
        },
      ]);

      renderWithProviders(<LostFoundCard post={mockPost} />);

      // Click Report post button
      const reportPostBtn = screen.getByRole('button', { name: /Report post/i });
      await user.click(reportPostBtn);

      expect(screen.getByText(/Report Lost Golden Retriever/i)).toBeInTheDocument();
    });
  });
});
