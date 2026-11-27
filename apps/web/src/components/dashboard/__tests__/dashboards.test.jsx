import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CitizenDashboard } from '../CitizenDashboard';
import { AdminDashboard } from '../AdminDashboard';
import { ShelterDashboard } from '../ShelterDashboard';
import { NGODashboard } from '../NGODashboard';
import { VetDashboard } from '../VetDashboard';
import { VolunteerDashboard } from '../VolunteerDashboard';

import { useAuthStore } from '@/store/authStore';
import * as rescueService from '@/services/rescue.service';
import * as animalService from '@/services/animal.service';
import * as userService from '@/services/user.service';
import * as adoptionService from '@/services/adoption.service';
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

describe('Role Dashboards Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CitizenDashboard renders quick action cards and rescue lists', () => {
    useAuthStore.getState().setUser({
      uid: 'cit-1',
      id: 'cit-1',
      displayName: 'Citizen Jane',
      role: UserRole.CITIZEN,
    });
    vi.spyOn(rescueService, 'getRescueRequests').mockResolvedValue([]);

    render(<CitizenDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Citizen Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Emergency SOS')).toBeInTheDocument();
  });

  it('VetDashboard renders examination metrics', () => {
    render(<VetDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Examinations')).toBeInTheDocument();
    expect(screen.getByText('Pending Medical Reviews')).toBeInTheDocument();
  });

  it('VolunteerDashboard renders active missions and completed rescues', () => {
    useAuthStore.getState().setUser({
      uid: 'vol-1',
      id: 'vol-1',
      displayName: 'Volunteer Sam',
      role: UserRole.VOLUNTEER,
    });
    vi.spyOn(rescueService, 'getRescueRequests').mockResolvedValue([
      { id: 'res-1', status: 'RESOLVED', assignedTo: 'vol-1', title: 'Street Dog Rescue' },
    ]);

    render(<VolunteerDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText('Volunteer Dispatch Center')).toBeInTheDocument();
  });

  it('AdminDashboard renders operator and rescue administration tools', async () => {
    useAuthStore.getState().setUser({
      uid: 'adm-1',
      id: 'adm-1',
      displayName: 'Admin User',
      role: UserRole.ADMIN,
    });
    vi.spyOn(rescueService, 'getRescueRequests').mockResolvedValue([
      { id: 'r-adm-1', title: 'Pending Rescue', status: 'PENDING', severity: 'HIGH', species: 'DOG', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'r-adm-2', title: 'Resolved Rescue', status: 'RESOLVED', severity: 'LOW', species: 'CAT', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    vi.spyOn(userService, 'getUsers').mockResolvedValue([
      { id: 'u-pending-1', displayName: 'Jane Req', role: 'CITIZEN', requestedRole: 'VOLUNTEER' },
    ]);
    vi.spyOn(userService, 'updateUserRole').mockResolvedValue({});
    vi.spyOn(userService, 'declineRoleRequest').mockResolvedValue({});

    render(<AdminDashboard />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });

    const approveBtn = await screen.findByRole('button', { name: /Approve as VOLUNTEER/i });
    fireEvent.click(approveBtn);
    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);
  });

  it('ShelterDashboard renders animal intake and adoption workflows', async () => {
    useAuthStore.getState().setUser({
      uid: 'she-1',
      id: 'she-1',
      displayName: 'Happy Paws Shelter',
      role: UserRole.SHELTER,
    });
    vi.spyOn(animalService, 'getAnimals').mockImplementation((params) => {
      if (params?.adoptionStatus === 'NOT_READY') {
        return Promise.resolve([
          { id: 'surr-1', name: 'Surrendered Pup', species: 'DOG', adoptionStatus: 'NOT_READY', shelterId: null, createdAt: new Date().toISOString() },
        ]);
      }
      return Promise.resolve([
        { id: 'she-a-1', name: 'Milo', species: 'CAT', adoptionStatus: 'AVAILABLE', shelterId: 'she-1' },
        { id: 'she-a-2', name: 'Bella', species: 'DOG', adoptionStatus: 'NOT_READY', shelterId: 'she-1' },
      ]);
    });
    vi.spyOn(adoptionService, 'getApplicationsForReview').mockResolvedValue([
      { id: 'app-1', status: 'SUBMITTED', animalId: 'she-a-1', applicantId: 'u1' },
    ]);
    const claimSpy = vi.spyOn(animalService, 'claimAnimal').mockResolvedValue({});
    const clearSpy = vi.spyOn(animalService, 'updateAnimal').mockResolvedValue({});

    render(<ShelterDashboard />, { wrapper: createWrapper() });
    expect(screen.getByText(/Shelter Operations & Intake Center/i)).toBeInTheDocument();

    const intakeTab = screen.getByRole('button', { name: /Surrender Intake/i });
    fireEvent.click(intakeTab);

    const claimBtn = await screen.findByRole('button', { name: /Claim for Intake/i });
    fireEvent.click(claimBtn);

    const clearBtn = await screen.findByRole('button', { name: /Clear for Adoption/i });
    fireEvent.click(clearBtn);

    const reviewsTab = screen.getByRole('button', { name: /Adoption Review Queue/i });
    fireEvent.click(reviewsTab);

    const residentsTab = screen.getByRole('button', { name: /Shelter Residents/i });
    fireEvent.click(residentsTab);
  });

  it('NGODashboard renders NGO mission dispatch controls', async () => {
    useAuthStore.getState().setUser({
      uid: 'ngo-1',
      id: 'ngo-1',
      displayName: 'Animal NGO',
      role: UserRole.NGO,
    });
    vi.spyOn(rescueService, 'getRescueRequests').mockResolvedValue([
      {
        id: 'res-ngo-1',
        title: 'Emergency Dog Rescue',
        status: 'PENDING',
        severity: 'HIGH',
        species: 'DOG',
        address: '123 Rescue St',
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(userService, 'getUsers').mockResolvedValue([
      { id: 'vol-1', displayName: 'Volunteer Jane', role: 'VOLUNTEER' },
    ]);
    vi.spyOn(animalService, 'getAnimals').mockResolvedValue([
      { id: 'surr-ngo-1', name: 'Stray Cat', species: 'CAT', adoptionStatus: 'NOT_READY', createdAt: new Date().toISOString() },
    ]);
    vi.spyOn(rescueService, 'assignVolunteer').mockResolvedValue({});
    vi.spyOn(animalService, 'claimAnimal').mockResolvedValue({});

    render(<NGODashboard />, { wrapper: createWrapper() });
    expect(screen.getByText(/NGO Dispatch & Response Hub/i)).toBeInTheDocument();

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'vol-1' } });

    const claimBtn = await screen.findByRole('button', { name: /Claim for Care/i });
    fireEvent.click(claimBtn);
  });
});
