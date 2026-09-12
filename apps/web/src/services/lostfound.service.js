import api from '@/lib/api';
import { uploadMultipleFiles } from "./storage.service";

const createPost = async (data, photos) => {
  let photoUrls = [];
  if (photos && photos.length > 0) {
    try {
      const tempId = crypto.randomUUID();
      photoUrls = await uploadMultipleFiles(`lostfound-photos/${tempId}`, photos);
    } catch (err) {
      console.warn("Storage upload failed for lost/found", err);
      photoUrls = ["https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000"];
    }
  }

  const payload = {
    ...data,
    photoUrls,
  };

  const response = await api.post('/lostfound/', payload);
  return response.data.id;
};

const getPosts = async (filters) => {
  const response = await api.get('/lostfound/', { params: filters });
  return response.data;
};

const getPostById = async (id) => {
  const response = await api.get(`/lostfound/${id}`);
  return response.data;
};

const updatePostStatus = async (id, status) => {
  await api.patch(`/lostfound/${id}/status`, { status });
};

const deletePost = async (id) => {
  await api.delete(`/lostfound/${id}`);
};

const getReplies = async (id) => {
  const response = await api.get(`/lostfound/${id}/replies`);
  return response.data;
};

const addReply = async (id, text) => {
  const response = await api.post(`/lostfound/${id}/replies`, { text });
  return response.data;
};

export {
  createPost,
  deletePost,
  getPostById,
  getPosts,
  updatePostStatus,
  getReplies,
  addReply
};
