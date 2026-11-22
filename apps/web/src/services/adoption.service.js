import api from "@/lib/api";

const submitApplication = async (data) => {
  const payload = {
    animalId: data.animalId,
    livingEnvironment: data.livingEnvironment,
    hasYard: data.hasYard || false,
    hasOtherPets: data.hasOtherPets || false,
    otherPetDetails: data.otherPetDetails,
    priorPetExperience: data.priorPetExperience,
    familyMembers: data.familyMembers ? parseInt(data.familyMembers, 10) : 1,
    hasChildren: data.hasChildren || false,
    workSchedule: data.workSchedule,
    whyAdopt: data.whyAdopt,
  };

  const response = await api.post('/adoptions/', payload);
  return response.data.id;
};

const getApplicationsByApplicant = async (applicantId) => {
  const response = await api.get('/adoptions/', { params: { applicantId } });
  return response.data;
};

const getApplicationsByAnimal = async (animalId) => {
  const response = await api.get('/adoptions/', { params: { animalId } });
  return response.data;
};

const getApplicationsForReview = async (status) => {
  const params = status ? { status } : {};
  const response = await api.get('/adoptions/', { params });
  return response.data;
};

const reviewApplication = async (id, status, reviewerId, screeningNotes) => {
  await api.patch(`/adoptions/${id}/status`, {
    status,
    screeningNotes,
  });
};

const getApplicationById = async (id) => {
  try {
    const response = await api.get(`/adoptions/${id}`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

export {
  getApplicationById,
  getApplicationsByAnimal,
  getApplicationsByApplicant,
  getApplicationsForReview,
  reviewApplication,
  submitApplication
};
