import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import OperatorRegistryPage from '@/pages/OperatorRegistryPage';
import SystemSettingsPage from '@/pages/SystemSettingsPage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import DonationPage from '@/pages/DonationPage';
import MyApplicationsPage from '@/pages/MyApplicationsPage';
import AdoptionPage from '@/pages/AdoptionPage';
import AnimalsPage from '@/pages/AnimalsPage';
import SurrenderPage from '@/pages/SurrenderPage';
import ReportRescuePage from '@/pages/ReportRescuePage';
import HomePage from '@/pages/HomePage';
import ProfilePage from '@/pages/ProfilePage';
import RescueDetailPage from '@/pages/RescueDetailPage';
import RescueListPage from '@/pages/RescueListPage';
import LostFoundPage from '@/pages/LostFoundPage';
import AnimalDetailPage from '@/pages/AnimalDetailPage';
import App from '@/App';

import * as userService from '@/services/user.service';
import * as settingsService from '@/services/settings.service';
import * as auditService from '@/services/audit.service';
import * as adoptionService from '@/services/adoption.service';
import * as animalService from '@/services/animal.service';
import * as rescueService from '@/services/rescue.service';
import * as lostfoundService from '@/services/lostfound.service';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@aniresq/shared-types';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const createRouteWrapper = (routePattern, initialEntry) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePattern} element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Page Components & Admin 403 Forbidden Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setUser({
      uid: 'admin-1',
      id: 'admin-1',
      email: 'admin@aniresq.com',
      role: UserRole.ADMIN,
    });
  });

  describe('Admin Pages 403 Friendly Error Handling', () => {
    it('OperatorRegistryPage shows friendly Access Restricted message on 403 Forbidden', async () => {
      vi.spyOn(userService, 'getUsers').mockRejectedValue({
        response: { status: 403, data: { detail: 'Forbidden' } },
      });

      render(<OperatorRegistryPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(
          screen.getByText(/You do not have administrative clearance to access the Operator Registry/i)
        ).toBeInTheDocument();
      });
    });

    it('OperatorRegistryPage renders operator list on success', async () => {
      const mockOp = {
        id: 'op-1',
        displayName: 'Dr. John Doe',
        email: 'john@vet.org',
        role: 'VET',
        requestedRole: 'ADMIN',
        idCardNumber: 'VET-12345',
        phone: '123',
        createdAt: new Date().toISOString(),
      };
      vi.spyOn(userService, 'getUsers').mockResolvedValue([mockOp]);
      const updateRoleSpy = vi.spyOn(userService, 'updateUserRole').mockResolvedValue({ success: true });
      const declineSpy = vi.spyOn(userService, 'declineRoleRequest').mockResolvedValue({ success: true });

      render(<OperatorRegistryPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Operator Registry', level: 1 })).toBeInTheDocument();
        expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
      });

      // Click manage modal
      const manageBtn = screen.getByRole('button', { name: /Manage/i });
      fireEvent.click(manageBtn);

      expect(screen.getByText('Adjust Clearance Role')).toBeInTheDocument();

      // Cancel modal
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      // Quick approve and decline buttons
      const approveBtn = screen.getByTitle('Approve as ADMIN');
      fireEvent.click(approveBtn);
      const declineBtn = screen.getByTitle('Decline Request');
      fireEvent.click(declineBtn);

      // Role filter pill buttons
      const volunteerPill = screen.getByRole('button', { name: 'VOLUNTEER' });
      fireEvent.click(volunteerPill);
      const vetPill = screen.getByRole('button', { name: 'VET' });
      fireEvent.click(vetPill);

      // Search input, pending toggle, and refresh
      const searchBox = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchBox, { target: { value: 'John' } });

      const pendingCheckbox = screen.getByLabelText(/Show Pending Clearance Only/i);
      fireEvent.click(pendingCheckbox);

      const refreshBtn = screen.getByRole('button', { name: /Refresh Directory/i });
      fireEvent.click(refreshBtn);
    });

    it('SystemSettingsPage shows friendly Access Restricted message on 403 Forbidden', async () => {
      vi.spyOn(settingsService, 'getSystemSettings').mockRejectedValue({
        response: { status: 403, data: { detail: 'Forbidden' } },
      });

      render(<SystemSettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(
          screen.getByText(/You do not have administrative clearance to view or edit System Settings/i)
        ).toBeInTheDocument();
      });
    });

    it('SystemSettingsPage renders configuration form on success', async () => {
      vi.spyOn(settingsService, 'getSystemSettings').mockResolvedValue({
        defaultDispatchRadiusKm: 15,
        maxBroadcastCeilingKm: 100,
        autoAlertHighSeverity: true,
        autoDispatchEnabled: true,
      });
      const updateSpy = vi.spyOn(settingsService, 'updateSystemSettings').mockResolvedValue({
        defaultDispatchRadiusKm: 20,
      });

      const { container } = render(<SystemSettingsPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'System Settings', level: 1 })).toBeInTheDocument();
        expect(screen.queryByText(/Loading configuration/i)).not.toBeInTheDocument();
      });

      const slider = container.querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: '25' } });
      }

      // Toggle routing switches
      const toggles = container.querySelectorAll('button[type="button"]');
      toggles.forEach((t) => fireEvent.click(t));

      const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
    });

    it('AuditLogsPage shows friendly Access Restricted message on 403 Forbidden', async () => {
      vi.spyOn(auditService, 'getAuditLogs').mockRejectedValue({
        response: { status: 403, data: { detail: 'Forbidden' } },
      });

      render(<AuditLogsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(
          screen.getByText(/You do not have administrative clearance to view System Audit Logs/i)
        ).toBeInTheDocument();
      });
    });

    it('AuditLogsPage renders security audit logs list and filters on success', async () => {
      const mockLog = {
        id: 'log-1',
        action: 'ROLE_CHANGE',
        performedBy: 'admin-1',
        entityType: 'USER',
        entityId: 'u-1',
        details: { oldRole: 'CITIZEN', newRole: 'VOLUNTEER' },
        oldValue: { role: 'CITIZEN' },
        newValue: { role: 'VOLUNTEER' },
        createdAt: new Date().toISOString(),
      };
      vi.spyOn(auditService, 'getAuditLogs').mockResolvedValue([mockLog]);

      render(<AuditLogsPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText('Security Audit Logs')).toBeInTheDocument();
        expect(screen.getByText('ROLE_CHANGE')).toBeInTheDocument();
      });

      // Expand diff
      const viewDiffBtn = screen.getByRole('button', { name: /View Diff/i });
      fireEvent.click(viewDiffBtn);
      expect(screen.getByText(/Hide Diff/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Hide Diff/i }));

      // Filter by action
      const actionSelect = screen.getByLabelText('Filter by action');
      fireEvent.change(actionSelect, { target: { value: 'ROLE_CHANGE' } });

      // Filter by entity
      const entitySelect = screen.getByLabelText('Filter by entity type');
      fireEvent.change(entitySelect, { target: { value: 'USER' } });
    });
  });

  describe('Static & Informational Pages', () => {
    it('NotFoundPage renders 404 header and home navigation link', () => {
      render(<NotFoundPage />, { wrapper: createWrapper() });
      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    });

    it('UnauthorizedPage renders 403 access denied message', () => {
      render(<UnauthorizedPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    });

    it('DonationPage renders support message and contribution tiers', () => {
      render(<DonationPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Support Animal Rescue & Care')).toBeInTheDocument();
      expect(screen.getByText('Adopt or Foster')).toBeInTheDocument();
    });

    it('AdoptionPage, AnimalsPage, SurrenderPage, ReportRescuePage render without error', async () => {
      vi.spyOn(animalService, 'getAnimalById').mockResolvedValue({
        id: 'an-1',
        name: 'Buddy',
        species: 'DOG',
        breed: 'Labrador',
        ageEstimate: '2 years',
        photos: [],
      });

      render(<AdoptionPage />, { wrapper: createRouteWrapper('/adopt/:animalId', '/adopt/an-1') });
      await waitFor(() => {
        expect(screen.getByText('Adoption Application')).toBeInTheDocument();
      });

      render(<AnimalsPage />, { wrapper: createWrapper() });
      render(<SurrenderPage />, { wrapper: createWrapper() });
      render(<ReportRescuePage />, { wrapper: createWrapper() });
    });

    it('MyApplicationsPage renders user applications', async () => {
      vi.spyOn(adoptionService, 'getApplicationsByApplicant').mockResolvedValue([
        { id: 'my-app-1', status: 'SUBMITTED', animalId: 'a1', createdAt: new Date().toISOString() },
      ]);
      vi.spyOn(animalService, 'getAnimalById').mockResolvedValue({
        id: 'a1',
        name: 'Daisy',
        photos: ['https://test.co/daisy.jpg'],
      });

      render(<MyApplicationsPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText('My Adoption Applications')).toBeInTheDocument();
        expect(screen.getByText('Daisy')).toBeInTheDocument();
      });

      const submittedTab = screen.getByRole('tab', { name: 'Submitted' });
      fireEvent.click(submittedTab);
    });

    it('HomePage renders hero section and featured animals', async () => {
      vi.spyOn(animalService, 'getFeaturedAnimals').mockResolvedValue([
        { id: 'fa-1', name: 'Luna', species: 'DOG', photos: [] },
      ]);

      render(<HomePage />, { wrapper: createWrapper() });
      expect(screen.getAllByText(/AniResQ/i).length).toBeGreaterThan(0);
    });

    it('ProfilePage renders user credentials and responder clearance sections', async () => {
      useAuthStore.getState().setUser({
        uid: 'user-prof-1',
        id: 'user-prof-1',
        displayName: 'Dr. Jane Vet',
        email: 'jane@vetclinic.org',
        phone: '555-0199',
        role: UserRole.VOLUNTEER,
        requestedRole: 'VET',
        serviceRadiusKm: 25,
        alertsEnabled: true,
      });
      vi.spyOn(userService, 'updateUserProfile').mockResolvedValue({});
      vi.spyOn(userService, 'withdrawClearance').mockResolvedValue({});

      render(<ProfilePage />, { wrapper: createWrapper() });
      expect(screen.getAllByText('Dr. Jane Vet').length).toBeGreaterThan(0);
      expect(screen.getByText('jane@vetclinic.org')).toBeInTheDocument();

      const editBtn = screen.getByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      const phoneInput = screen.getByDisplayValue('555-0199');
      fireEvent.change(phoneInput, { target: { value: '555-9999' } });

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      const saveAlertsBtn = screen.getByRole('button', { name: /Save Alert Settings/i });
      fireEvent.click(saveAlertsBtn);

      const withdrawBtn = screen.getByRole('button', { name: /Withdraw Request/i });
      fireEvent.click(withdrawBtn);

      // Now test Citizen submitting a clearance request
      useAuthStore.getState().setUser({
        uid: 'user-cit-1',
        id: 'user-cit-1',
        displayName: 'John Citizen',
        email: 'john@cit.org',
        role: UserRole.CITIZEN,
        requestedRole: null,
      });
      const clearanceSpy = vi.spyOn(userService, 'requestClearance').mockResolvedValue({});
      render(<ProfilePage />, { wrapper: createWrapper() });
      const submitReqBtns = screen.getAllByRole('button', { name: /Submit Clearance Request/i });
      fireEvent.click(submitReqBtns[0]);
    });

    it('RescueDetailPage renders incident map, status, and timeline', async () => {
      vi.spyOn(rescueService, 'getRescueRequestById').mockResolvedValue({
        id: 'res-detail-1',
        title: 'Trapped dog in ditch',
        description: 'Needs winch support',
        status: 'DISPATCHED',
        severity: 'HIGH',
        species: 'DOG',
        address: 'Mile 4 Highway 9',
        reporterId: 'reporter-1',
        assignedTo: 'admin-1',
        reporterName: 'Good Citizen',
        createdAt: new Date().toISOString(),
      });
      vi.spyOn(rescueService, 'getRescueTimeline').mockResolvedValue([
        { id: 'tl-1', status: 'DISPATCHED', message: 'Team dispatched', createdAt: new Date().toISOString() },
      ]);
      const statusSpy = vi.spyOn(rescueService, 'updateRescueStatus').mockResolvedValue();

      render(<RescueDetailPage />, { wrapper: createRouteWrapper('/rescues/:id', '/rescues/res-detail-1') });
      await waitFor(() => {
        expect(screen.getByText('Trapped dog in ditch')).toBeInTheDocument();
      });

      const onSceneBtn = screen.getByRole('button', { name: /Mark In Progress \(On-Scene\)/i });
      fireEvent.click(onSceneBtn);
      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalled();
      });

      // IN_PROGRESS status opens resolve modal
      vi.spyOn(rescueService, 'getRescueRequestById').mockResolvedValue({
        id: 'res-detail-1',
        title: 'Trapped dog in ditch',
        description: 'Needs winch support',
        status: 'IN_PROGRESS',
        severity: 'HIGH',
        species: 'DOG',
        address: 'Mile 4 Highway 9',
        reporterId: 'reporter-1',
        assignedTo: 'admin-1',
        createdAt: new Date().toISOString(),
      });
      render(<RescueDetailPage />, { wrapper: createRouteWrapper('/rescues/:id', '/rescues/res-detail-1') });
      const resolveBtn = await screen.findByRole('button', { name: /Mark Resolved with Verification Photo/i });
      fireEvent.click(resolveBtn);
      expect(screen.getByText('Resolve Emergency SOS')).toBeInTheDocument();

      // PENDING status allows responder to accept mission
      vi.spyOn(rescueService, 'getRescueRequestById').mockResolvedValue({
        id: 'res-detail-2',
        title: 'Trapped kitten in tree',
        status: 'PENDING',
        severity: 'HIGH',
        species: 'CAT',
        address: 'Oak St 5',
        reporterId: 'reporter-2',
        createdAt: new Date().toISOString(),
      });
      const assignSpy = vi.spyOn(rescueService, 'assignVolunteer').mockResolvedValue();
      render(<RescueDetailPage />, { wrapper: createRouteWrapper('/rescues/:id', '/rescues/res-detail-2') });
      const acceptBtn = await screen.findByRole('button', { name: /Dispatch Unit \/ Accept Mission/i });
      fireEvent.click(acceptBtn);
      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalled();
      });
    });

    it('RescueListPage renders rescue alert cards and map filters', async () => {
      vi.spyOn(rescueService, 'getRescueRequests').mockResolvedValue([
        {
          id: 'res-l-1',
          title: 'Puppy Rescue',
          status: 'PENDING',
          severity: 'MEDIUM',
          species: 'DOG',
          createdAt: new Date().toISOString(),
        },
      ]);
      vi.spyOn(rescueService, 'getPublicRescues').mockResolvedValue([]);

      render(<RescueListPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText(/Active SOS Alerts|Community Rescue Map/i)).toBeInTheDocument();
      });

      // Filter by status & severity
      const statusSelect = screen.getByLabelText('Filter rescues by status');
      fireEvent.change(statusSelect, { target: { value: 'PENDING' } });
      const severitySelect = screen.getByLabelText('Filter rescues by severity');
      fireEvent.change(severitySelect, { target: { value: 'HIGH' } });

      // Switch to Map View tab
      const mapTab = screen.getByRole('tab', { name: /Map View/i });
      fireEvent.click(mapTab);
    });

    it('LostFoundPage renders pet directory and report modal', async () => {
      vi.spyOn(lostfoundService, 'getPosts').mockResolvedValue([
        {
          id: 'lf-p-1',
          title: 'Lost Golden Retriever',
          type: 'LOST',
          status: 'OPEN',
          contactPhone: '1234567890',
          createdAt: new Date().toISOString(),
          date: new Date().toISOString(),
        }
      ]);

      render(<LostFoundPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText('Lost Golden Retriever')).toBeInTheDocument();
      });

      // Switch tabs
      const lostTab = screen.getByRole('tab', { name: /Lost Pets/i });
      fireEvent.click(lostTab);
      const foundTab = screen.getByRole('tab', { name: /Found Pets/i });
      fireEvent.click(foundTab);
    });

    it('AnimalDetailPage renders animal profile details', async () => {
      vi.spyOn(animalService, 'getAnimalById').mockResolvedValue({
        id: 'an-p-1',
        name: 'Barnaby',
        species: 'DOG',
        breed: 'Beagle',
        ageEstimate: '4 years',
        gender: 'MALE',
        healthStatus: 'HEALTHY',
        photos: [],
      });

      render(<AnimalDetailPage />, { wrapper: createRouteWrapper('/animals/:id', '/animals/an-p-1') });
      await waitFor(() => {
        expect(screen.getByText('Barnaby')).toBeInTheDocument();
      });
    });

    it('App root component mounts without crashing', async () => {
      render(<App />, { wrapper: createWrapper() });
    });
  });
});
