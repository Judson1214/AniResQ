import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DashboardPage from '../DashboardPage';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@aniresq/shared-types';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }) => React.createElement('div', { 'data-testid': 'layout' }, children),
}));

vi.mock('@/components/dashboard/AdminDashboard', () => ({
  AdminDashboard: () => React.createElement('div', null, 'AdminDashboard'),
}));

vi.mock('@/components/dashboard/VolunteerDashboard', () => ({
  VolunteerDashboard: () => React.createElement('div', null, 'VolunteerDashboard'),
}));

vi.mock('@/components/dashboard/ShelterDashboard', () => ({
  ShelterDashboard: () => React.createElement('div', null, 'ShelterDashboard'),
}));

vi.mock('@/components/dashboard/NGODashboard', () => ({
  NGODashboard: () => React.createElement('div', null, 'NGODashboard'),
}));

vi.mock('@/components/dashboard/VetDashboard', () => ({
  VetDashboard: () => React.createElement('div', null, 'VetDashboard'),
}));

vi.mock('@/components/dashboard/CitizenDashboard', () => ({
  CitizenDashboard: () => React.createElement('div', null, 'CitizenDashboard'),
}));

import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { VolunteerDashboard } from '@/components/dashboard/VolunteerDashboard';
import { ShelterDashboard } from '@/components/dashboard/ShelterDashboard';
import { NGODashboard } from '@/components/dashboard/NGODashboard';
import { VetDashboard } from '@/components/dashboard/VetDashboard';
import { CitizenDashboard } from '@/components/dashboard/CitizenDashboard';

describe('DashboardPage Role-Based Component Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AdminDashboard for ADMIN role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u1', role: UserRole.ADMIN },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(AdminDashboard);
  });

  it('renders VolunteerDashboard for VOLUNTEER role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u2', role: UserRole.VOLUNTEER },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(VolunteerDashboard);
  });

  it('renders ShelterDashboard for SHELTER role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u3', role: UserRole.SHELTER },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(ShelterDashboard);
  });

  it('renders NGODashboard for NGO role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u4', role: UserRole.NGO },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(NGODashboard);
  });

  it('renders VetDashboard for VET role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u5', role: UserRole.VET },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(VetDashboard);
  });

  it('renders CitizenDashboard for CITIZEN role', () => {
    useAuth.mockReturnValue({
      user: { uid: 'u6', role: UserRole.CITIZEN },
      isLoading: false,
    });

    const page = DashboardPage();
    const renderedDashboard = page.props.children.props.children;
    expect(renderedDashboard.type).toBe(CitizenDashboard);
  });
});
