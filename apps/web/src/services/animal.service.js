import api from "@/lib/api";
import { uploadMultipleFiles } from "./storage.service";
import { AdoptionStatus } from "@aniresq/shared-types";

const createAnimal = async (data, photos) => {
  let photoUrls = [];
  if (photos && photos.length > 0) {
    const tempId = crypto.randomUUID();
    photoUrls = await uploadMultipleFiles(`animal-photos/${tempId}`, photos);
  }

  const payload = {
    name: data.name,
    species: data.species,
    breed: data.breed,
    ageEstimate: data.ageEstimate,
    gender: data.gender,
    weight: data.weight ? parseFloat(data.weight) : null,
    healthStatus: data.healthStatus,
    adoptionStatus: data.adoptionStatus || AdoptionStatus.AVAILABLE,
    description: data.description,
    vaccinations: data.vaccinations || [],
    isNeutered: data.isNeutered || false,
    specialNeeds: data.specialNeeds,
    photos: photoUrls,
  };

  const response = await api.post('/animals/', payload);
  return response.data.id;
};

const surrenderAnimal = async (data, photos) => {
  let photoUrls = [];
  if (photos && photos.length > 0) {
    const tempId = crypto.randomUUID();
    photoUrls = await uploadMultipleFiles(`animal-photos/${tempId}`, photos);
  }

  const payload = {
    name: data.name,
    species: data.species,
    ageEstimate: data.ageEstimate || "Unknown",
    description: data.description,
    reason: data.reason || "",
    photos: photoUrls,
  };

  const response = await api.post('/animals/surrender', payload);
  return response.data.id;
};

const getAnimals = async (filters) => {
  const params = {};
  if (filters) {
    if (filters.species && filters.species !== "All") {
      params.species = filters.species;
    }
    if (filters.adoptionStatus) {
      params.status = filters.adoptionStatus;
    }
    if (filters.shelterId) {
      params.shelterId = filters.shelterId;
    }
  }

  const response = await api.get('/animals/', { params });
  return response.data;
};

const getAnimalById = async (id) => {
  try {
    const response = await api.get(`/animals/${id}`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

const updateAnimal = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.species !== undefined) payload.species = data.species;
  if (data.breed !== undefined) payload.breed = data.breed;
  if (data.ageEstimate !== undefined) payload.ageEstimate = data.ageEstimate;
  if (data.gender !== undefined) payload.gender = data.gender;
  if (data.weight !== undefined) payload.weight = data.weight ? parseFloat(data.weight) : null;
  if (data.healthStatus !== undefined) payload.healthStatus = data.healthStatus;
  if (data.adoptionStatus !== undefined) payload.adoptionStatus = data.adoptionStatus;
  if (data.description !== undefined) payload.description = data.description;
  if (data.vaccinations !== undefined) payload.vaccinations = data.vaccinations;
  if (data.isNeutered !== undefined) payload.isNeutered = data.isNeutered;
  if (data.specialNeeds !== undefined) payload.specialNeeds = data.specialNeeds;
  if (data.photos !== undefined) payload.photos = data.photos;

  await api.patch(`/animals/${id}`, payload);
};

const updateAdoptionStatus = async (animalId, newStatus) => {
  await api.patch(`/animals/${animalId}`, { adoptionStatus: newStatus });
};

const claimAnimal = async (animalId) => {
  const response = await api.post(`/animals/${animalId}/claim`);
  return response.data;
};

const getFeaturedAnimals = async (limitNum = 6) => {
  const response = await api.get('/animals/', {
    params: { status: AdoptionStatus.AVAILABLE, limit: limitNum }
  });
  return response.data;
};

export {
  claimAnimal,
  createAnimal,
  getAnimalById,
  getAnimals,
  getFeaturedAnimals,
  surrenderAnimal,
  updateAdoptionStatus,
  updateAnimal
};
