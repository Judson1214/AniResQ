import { z } from "zod";
import { LostFoundType } from "@aniresq/shared-types";
const lostFoundSchema = z.object({
  type: z.nativeEnum(LostFoundType),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  species: z.string().min(2, "Species must be at least 2 characters"),
  breed: z.string().optional(),
  color: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  lastSeenAddress: z.string().min(5, "Address must be at least 5 characters"),
  lastSeenDate: z.union([z.date(), z.string()]),
  contactPhone: z.string().min(5, "Contact phone is required"),
  contactEmail: z.string().email("Invalid email address").optional()
});
export {
  lostFoundSchema
};
