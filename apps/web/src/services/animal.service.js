import { supabase } from "@/config/supabase";
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
  const dbData = {
    name: data.name,
    species: data.species,
    breed: data.breed,
    age_estimate: data.ageEstimate,
    gender: data.gender,
    weight: data.weight,
    health_status: data.healthStatus,
    adoption_status: data.adoptionStatus || AdoptionStatus.AVAILABLE,
    description: data.description,
    vaccinations: data.vaccinations || [],
    is_neutered: data.isNeutered || false,
    special_needs: data.specialNeeds,
    shelter_id: data.shelterId
  };

  const { data: inserted, error } = await supabase
    .from('animals')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  const docId = inserted.id;

  if (photos && photos.length > 0) {
    const photoUrls = await uploadMultipleFiles(`animal-photos/${docId}`, photos);
    const { error: updateError } = await supabase
      .from('animals')
      .update({ images: photoUrls })
      .eq('id', docId);
    if (updateError) throw updateError;
  }
  return docId;
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
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.species !== undefined) updateData.species = data.species;
  if (data.breed !== undefined) updateData.breed = data.breed;
  if (data.ageEstimate !== undefined) updateData.age_estimate = data.ageEstimate;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.healthStatus !== undefined) updateData.health_status = data.healthStatus;
  if (data.adoptionStatus !== undefined) updateData.adoption_status = data.adoptionStatus;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.vaccinations !== undefined) updateData.vaccinations = data.vaccinations;
  if (data.isNeutered !== undefined) updateData.is_neutered = data.isNeutered;
  if (data.specialNeeds !== undefined) updateData.special_needs = data.specialNeeds;

  const { error } = await supabase
    .from('animals')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
};

const updateAdoptionStatus = async (id, status) => {
  const { error } = await supabase
    .from('animals')
    .update({ adoption_status: status })
    .eq('id', id);

  if (error) throw error;
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
  updateAdoptionStatus,
  updateAnimal
};
