import { z } from "zod"

export const safetyReportSchema = z.object({
  reportType: z.string().min(1, "Report type is required"),

  location: z.string().trim().min(1, "Location is required"),

  latitude: z
    .string()
    .trim()
    .min(1, "Latitude is required")
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) >= -90 &&
        Number(value) <= 90,
      "Latitude must be between -90 and 90",
    ),

  longitude: z
    .string()
    .trim()
    .min(1, "Longitude is required")
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) >= -180 &&
        Number(value) <= 180,
      "Longitude must be between -180 and 180",
    ),

  dateTime: z.string().min(1, "Date and time are required"),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be 500 characters or less"),
})

export type SafetyReportFormData = z.infer<typeof safetyReportSchema>
