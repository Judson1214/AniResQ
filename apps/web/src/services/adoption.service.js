import { supabase } from "@/config/supabase";
import { ApplicationStatus } from "@aniresq/shared-types";

const mapApplicationToCamelCase = (dbData) => ({
  id: dbData.id,
  animalId: dbData.animal_id,
  applicantId: dbData.applicant_id,
  livingEnvironment: dbData.living_environment,
  hasYard: dbData.has_yard,
  hasOtherPets: dbData.has_other_pets,
  otherPetDetails: dbData.other_pet_details,
  priorPetExperience: dbData.prior_pet_experience,
  familyMembers: dbData.family_members,
  hasChildren: dbData.has_children,
  workSchedule: dbData.work_schedule,
  whyAdopt: dbData.why_adopt,
  status: dbData.status,
  reviewerId: dbData.reviewer_id,
  screeningNotes: dbData.screening_notes,
  createdAt: dbData.created_at,
  updatedAt: dbData.updated_at,
  reviewedAt: dbData.reviewed_at
});

const submitApplication = async (data) => {
  const dbData = {
    animal_id: data.animalId,
    applicant_id: data.applicantId,
    living_environment: data.livingEnvironment,
    has_yard: data.hasYard || false,
    has_other_pets: data.hasOtherPets || false,
    other_pet_details: data.otherPetDetails,
    prior_pet_experience: data.priorPetExperience,
    family_members: data.familyMembers,
    has_children: data.hasChildren || false,
    work_schedule: data.workSchedule,
    why_adopt: data.whyAdopt,
    status: ApplicationStatus.SUBMITTED
  };

  const { data: inserted, error } = await supabase
    .from('adoption_applications')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return inserted.id;
};

const getApplicationsByApplicant = async (applicantId) => {
  const { data, error } = await supabase
    .from('adoption_applications')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapApplicationToCamelCase);
};

const getApplicationsByAnimal = async (animalId) => {
  const { data, error } = await supabase
    .from('adoption_applications')
    .select('*')
    .eq('animal_id', animalId);

  if (error) throw error;
  return data.map(mapApplicationToCamelCase);
};

const getApplicationsForReview = async (status) => {
  let query = supabase.from('adoption_applications').select('*').order('created_at', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapApplicationToCamelCase);
};

const reviewApplication = async (id, status, reviewerId, screeningNotes) => {
  const { error } = await supabase
    .from('adoption_applications')
    .update({
      status,
      reviewer_id: reviewerId,
      screening_notes: screeningNotes,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
};

const getApplicationById = async (id) => {
  const { data, error } = await supabase
    .from('adoption_applications')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // 404
    throw error;
  }
  return mapApplicationToCamelCase(data);
};

export {
  getApplicationById,
  getApplicationsByAnimal,
  getApplicationsByApplicant,
  getApplicationsForReview,
  reviewApplication,
  submitApplication
};
