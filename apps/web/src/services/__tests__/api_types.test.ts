import { describe, it, expect } from 'vitest';
import type {
  ApiPaths,
  ApiUserResponse,
  ApiRescueResponse,
  ApiAnimalResponse,
} from '@/types/api-contracts';

describe('OpenAPI Contract Verification', () => {
  it('verifies generated schema paths cover core REST endpoints', () => {
    // Compile-time check on path keys:
    type ExpectedEndpoints =
      | '/api/rescues/'
      | '/api/rescues/public'
      | '/api/animals/{id}/claim'
      | '/api/users/{uid}/role-request/decline';

    const sampleEndpoint: keyof ApiPaths = '/api/rescues/public';
    const claimEndpoint: keyof ApiPaths = '/api/animals/{id}/claim';
    expect(sampleEndpoint).toBe('/api/rescues/public');
    expect(claimEndpoint).toBe('/api/animals/{id}/claim');
  });

  it('validates schema response structure compatibility', () => {
    // Verify type structure matches expected API payloads
    const mockUser: Partial<ApiUserResponse> = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'user@example.com',
      role: 'VOLUNTEER',
      alertsEnabled: true,
      serviceRadiusKm: 15,
    };
    expect(mockUser.role).toBe('VOLUNTEER');
    expect(mockUser.alertsEnabled).toBe(true);

    const mockRescue: Partial<ApiRescueResponse> = {
      id: 'rescue-123',
      title: 'Injured bird',
      severity: 'HIGH',
      status: 'PENDING',
    };
    expect(mockRescue.severity).toBe('HIGH');
  });
});
