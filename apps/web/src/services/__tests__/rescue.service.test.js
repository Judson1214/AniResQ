import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import {
  getRescueRequests,
  getRescueRequestById,
  updateRescueStatus,
  assignVolunteer,
  deleteRescueRequest,
} from '../rescue.service';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Rescue Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRescueRequests fetches rescues with pagination params', async () => {
    const mockRescues = [
      { id: '1', title: 'Injured bird', severity: 'HIGH', status: 'PENDING' },
    ];
    api.get.mockResolvedValueOnce({ data: mockRescues });

    const result = await getRescueRequests({ limit: 10, offset: 0 });
    expect(api.get).toHaveBeenCalledWith('/rescues/', {
      params: { limit: 10, offset: 0 },
    });
    expect(result).toEqual(mockRescues);
  });

  it('getRescueRequestById fetches single rescue', async () => {
    const mockRescue = { id: 'rescue-123', title: 'Dog rescue' };
    api.get.mockResolvedValueOnce({ data: mockRescue });

    const result = await getRescueRequestById('rescue-123');
    expect(api.get).toHaveBeenCalledWith('/rescues/rescue-123');
    expect(result).toEqual(mockRescue);
  });

  it('updateRescueStatus sends status update payload', async () => {
    api.patch.mockResolvedValueOnce({ data: { id: 'r1', status: 'RESOLVED' } });

    await updateRescueStatus('r1', 'RESOLVED', 'Animal safely recovered');
    expect(api.patch).toHaveBeenCalledWith('/rescues/r1/status', {
      status: 'RESOLVED',
      message: 'Animal safely recovered',
      updatedBy: undefined,
      updatedByName: undefined,
    });
  });

  it('assignVolunteer assigns volunteer to rescue', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'r1', status: 'DISPATCHED' } });

    await assignVolunteer('r1', 'vol-1', 'Alex Responder');
    expect(api.post).toHaveBeenCalledWith('/rescues/r1/assign', {
      volunteerId: 'vol-1',
      volunteerName: 'Alex Responder',
    });
  });

  it('deleteRescueRequest calls delete endpoint', async () => {
    api.delete.mockResolvedValueOnce({ data: { deleted: true } });

    await deleteRescueRequest('r1');
    expect(api.delete).toHaveBeenCalledWith('/rescues/r1');
  });
});
