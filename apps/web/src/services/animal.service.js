import { supabase } from "@/config/supabase";
import api from "@/lib/api";
import { uploadMultipleFiles } from "./storage.service";
import { AdoptionStatus } from "@aniresq/shared-types";

const mapAnimalToCamelCase = (dbData) => ({
  id: dbData.id,
  name: dbData.name,
  species: dbData.species,
  breed: dbData.breed,
  ageEstimate: dbData.age_estimate,
  gender: dbData.gender,
  weight: dbData.weight,
  healthStatus: dbData.health_status,
  adoptionStatus: dbData.adoption_status,
  description: dbData.description,
  vaccinations: dbData.vaccinations || [],
  isNeutered: dbData.is_neutered,
  specialNeeds: dbData.special_needs,
  shelterId: dbData.shelter_id,
  photos: dbData.images || [],
  createdAt: dbData.created_at,
  updatedAt: dbData.updated_at
});

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
  let query = supabase.from('animals').select('*').order('created_at', { ascending: false });

  if (filters) {
    if (filters.species && filters.species !== "All") {
      query = query.eq('species', filters.species);
    }
    if (filters.adoptionStatus) {
      query = query.eq('adoption_status', filters.adoptionStatus);
    }
    if (filters.shelterId) {
      query = query.eq('shelter_id', filters.shelterId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.map(mapAnimalToCamelCase);
};

const getAnimalById = async (id) => {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // 404
    throw error;
  }
  return mapAnimalToCamelCase(data);
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

const getFeaturedAnimals = async (limitNum) => {
  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('adoption_status', AdoptionStatus.AVAILABLE)
    .order('created_at', { ascending: false })
    .limit(limitNum);

  if (error) throw error;
  return data.map(mapAnimalToCamelCase);
};

export {
  createAnimal,
  getAnimalById,
  getAnimals,
  getFeaturedAnimals,
  surrenderAnimal,
  updateAdoptionStatus,
  updateAnimal
};
