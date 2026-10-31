import api from '@/lib/api';
import { uploadMultipleFiles } from './storage.service';

const createRescueRequest = async (data, photos) => {
  let photoUrls = [];
  // Upload photos directly to Supabase Storage,
  // and send the resulting URLs to the backend API.
  if (photos && photos.length > 0) {
    const tempId = crypto.randomUUID();
    photoUrls = await uploadMultipleFiles(`rescue-photos/${tempId}`, photos);
  }

  const payload = {
    ...data,
    photoUrls,
  };

  const response = await api.post('/rescues/', payload);
  return response.data.id;
};

const getRescueRequests = async (filters) => {
  // Pass filters as query params to Python backend
  const response = await api.get('/rescues/', { params: filters });
  return response.data;
};

const getRescueRequestById = async (id) => {
  const response = await api.get(`/rescues/${id}`);
  return response.data;
};

const updateRescueStatus = async (id, status, message, updatedBy, updatedByName) => {
  await api.patch(`/rescues/${id}/status`, {
    status,
    message,
    updatedBy,
    updatedByName,
  });
};

const assignVolunteer = async (id, volunteerId, volunteerName) => {
  await api.post(`/rescues/${id}/assign`, {
    volunteerId,
    volunteerName,
  });
};

const getRescueTimeline = async (requestId) => {
  const response = await api.get(`/rescues/${requestId}/timeline`);
  return response.data;
};

const deleteRescueRequest = async (id) => {
  await api.delete(`/rescues/${id}`);
};

export {
  assignVolunteer,
  createRescueRequest,
  deleteRescueRequest,
  getRescueRequestById,
  getRescueRequests,
  getRescueTimeline,
  updateRescueStatus
};
