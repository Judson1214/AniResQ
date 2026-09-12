import { z } from "zod";
import { RescueSeverity } from "@aniresq/shared-types";
const rescueReportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title cannot exceed 100 characters"),
  description: z.string().min(20, "Description must be at least 20 characters").max(1e3, "Description cannot exceed 1000 characters"),
  severity: z.nativeEnum(RescueSeverity),
  species: z.string().min(2, "Species must be at least 2 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5, "Address must be at least 5 characters")
});
export {
  rescueReportSchema
};
