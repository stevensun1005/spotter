import { z } from "zod";

export const maxPhotoBase64Length = 2_400_000;
export const maxPhotoNoteLength = 300;
export const foodPhotoRequestSchema = z.object({
  expectedOwner: z.string().trim().min(1).max(120),
  mode: z.enum(["meal", "label"]),
  image: z.object({ mediaType: z.literal("image/jpeg"), base64: z.string().min(16).max(maxPhotoBase64Length)
    .refine((value) => value.length % 4 === 0 && value.startsWith("/9j/") && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) }).strict(),
  notes: z.string().trim().max(maxPhotoNoteLength).optional(),
}).strict();

export type FoodPhotoRequest = z.infer<typeof foodPhotoRequestSchema>;
