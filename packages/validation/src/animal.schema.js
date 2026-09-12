import { z } from "zod";
import { Species, Gender, HealthStatus, AdoptionStatus } from "@aniresq/shared-types";
const animalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  species: z.nativeEnum(Species),
  breed: z.string().optional(),
  ageEstimate: z.string().min(1, "Age estimate is required"),
  gender: z.nativeEnum(Gender),
  weight: z.number().optional(),
  healthStatus: z.nativeEnum(HealthStatus),
  adoptionStatus: z.nativeEnum(AdoptionStatus),
  description: z.string().min(10, "Description must be at least 10 characters").max(2e3, "Description cannot exceed 2000 characters"),
  vaccinations: z.array(z.string()),
  isNeutered: z.boolean(),
  specialNeeds: z.string().optional()
});
export {
  animalSchema
};
