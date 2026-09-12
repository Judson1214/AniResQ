import { z } from "zod";
import { LivingEnvironment } from "@aniresq/shared-types";
const adoptionApplicationSchema = z.object({
  livingEnvironment: z.nativeEnum(LivingEnvironment),
  hasYard: z.boolean(),
  hasOtherPets: z.boolean(),
  otherPetDetails: z.string().optional(),
  priorPetExperience: z.string().min(10, "Please provide more details about your experience"),
  familyMembers: z.number().min(1, "Must have at least 1 family member"),
  hasChildren: z.boolean(),
  workSchedule: z.string().min(5, "Please describe your work schedule"),
  whyAdopt: z.string().min(20, "Please provide a more detailed reason for adopting").max(1e3, "Cannot exceed 1000 characters")
}).refine((data) => {
  if (data.hasOtherPets && (!data.otherPetDetails || data.otherPetDetails.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Other pet details are required if you have other pets",
  path: ["otherPetDetails"]
});
export {
  adoptionApplicationSchema
};
