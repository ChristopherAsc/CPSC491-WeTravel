import { z } from "zod"

export const safetyReportSchema = z.object({
  reportType: z.string().min(1, "Report type is required"),
  location: z.string().min(1, "Location is required"),
  dateTime: z.string().min(1, "Date and time are required"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be 500 characters or less"),
})

export type SafetyReportFormData = z.infer<typeof safetyReportSchema>