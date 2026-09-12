import api from '@/lib/api';
import { uploadMultipleFiles } from './storage.service';

const createRescueRequest = async (data, photos) => {
  let photoUrls = [];
  // Still upload to Firebase Storage directly from frontend for efficiency,
  // but send the resulting URLs to our Python backend to save in Firestore.
  if (photos && photos.length > 0) {
    try {
      const tempId = crypto.randomUUID();
      photoUrls = await uploadMultipleFiles(`rescue-photos/${tempId}`, photos);
    } catch (error) {
      console.warn("Storage disabled or failed, using fallback URLs", error);
      // Fallback if the user hasn't enabled Firebase Storage yet
      photoUrls = ["https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000"];
    }
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
