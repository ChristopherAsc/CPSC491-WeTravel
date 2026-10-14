import { z } from "zod"

export const createPostSchema = z.object({
  caption: z.string().trim().min(1, "Caption is required").max(2200, "Caption must be 2,200 characters or fewer"),
  locationName: z.string().trim().min(1, "Location name is required"),
})

export type CreatePostFormData = z.infer<typeof createPostSchema>
