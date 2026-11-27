import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { useLocation, Navigate } from 'react-router-dom';
import { UserRole } from '@aniresq/shared-types';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', () => {
  const MockNavigate = vi.fn((props) => React.createElement('div', { 'data-navigate': props.to }));
  return {
    useLocation: vi.fn(),
    Navigate: MockNavigate,
  };
});

describe('ProtectedRoute allowedRoles guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocation.mockReturnValue({ pathname: '/admin' });
  });

  it('redirects unauthenticated users to /login with safe returnTo', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    useLocation.mockReturnValue({ pathname: '/admin', search: '' });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Secret Content'),
      allowedRoles: [UserRole.ADMIN],
    });

    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe('/login?returnTo=%2Fadmin');
    expect(element.props.replace).toBe(true);
  });

  it('sanitizes open redirect vectors in returnTo for unauthenticated users', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    useLocation.mockReturnValue({ pathname: '//evil.com/hack', search: '' });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Secret Content'),
      allowedRoles: [UserRole.ADMIN],
    });

    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe('/login?returnTo=%2Fdashboard');
  });

  it('renders accessible loading screen while auth is initializing', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Secret Content'),
      allowedRoles: [UserRole.ADMIN],
    });

    expect(element.type).not.toBe(Navigate);
    expect(element.props.role).toBe('status');
    expect(element.props['aria-live']).toBe('polite');
  });

  it('redirects unauthorized role to /unauthorized when allowedRoles is specified', () => {
    useAuth.mockReturnValue({
      user: { uid: 'user-citizen', role: UserRole.CITIZEN },
      isAuthenticated: true,
      isLoading: false,
    });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Admin Panel'),
      allowedRoles: [UserRole.ADMIN],
    });

    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe('/unauthorized');
    expect(element.props.replace).toBe(true);
  });

  it('allows authorized role matching allowedRoles', () => {
    useAuth.mockReturnValue({
      user: { uid: 'user-admin', role: UserRole.ADMIN },
      isAuthenticated: true,
      isLoading: false,
    });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Admin Panel'),
      allowedRoles: [UserRole.ADMIN],
    });

    expect(element.type).not.toBe(Navigate);
  });

  it('allows responders for responder routes', () => {
    const responderRoles = [
      UserRole.ADMIN,
      UserRole.VOLUNTEER,
      UserRole.SHELTER,
      UserRole.NGO,
      UserRole.VET,
    ];

    useAuth.mockReturnValue({
      user: { uid: 'user-vet', role: UserRole.VET },
      isAuthenticated: true,
      isLoading: false,
    });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Rescue Command'),
      allowedRoles: responderRoles,
    });

    expect(element.type).not.toBe(Navigate);
  });

  it('blocks citizen from responder routes', () => {
    const responderRoles = [
      UserRole.ADMIN,
      UserRole.VOLUNTEER,
      UserRole.SHELTER,
      UserRole.NGO,
      UserRole.VET,
    ];

    useAuth.mockReturnValue({
      user: { uid: 'user-citizen', role: UserRole.CITIZEN },
      isAuthenticated: true,
      isLoading: false,
    });

    const element = ProtectedRoute({
      children: React.createElement('div', null, 'Rescue Command'),
      allowedRoles: responderRoles,
    });

    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe('/unauthorized');
  });
});
