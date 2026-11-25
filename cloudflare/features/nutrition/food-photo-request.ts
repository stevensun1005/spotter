import { z } from "zod";

export const maxPhotoBase64Length = 2_400_000;
export const maxPhotoNoteLength = 300;
export const maxMealPhotoHistory = 6;
// The JSON limit allows escaped Unicode notes and meal history in addition to the JPEG.
export const maxFoodPhotoRequestLength = maxPhotoBase64Length + 16_000;

export const foodPhotoRequestSchema = z.object({
  expectedOwner: z.string().trim().min(1).max(120),
  mode: z.enum(["meal", "label", "protein"]),
  inCoach: z.literal(true).optional(),
  image: z.object({ mediaType: z.literal("image/jpeg"), base64: z.string().min(16).max(maxPhotoBase64Length)
    .refine((value) => value.length % 4 === 0 && value.startsWith("/9j/") && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) }).strict(),
  notes: z.string().trim().max(maxPhotoNoteLength).optional(),
  mealHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(maxPhotoNoteLength),
  }).strict()).min(1).max(maxMealPhotoHistory).optional(),
}).strict()
  .refine(({ mode, notes, inCoach }) => (mode !== "protein" || !notes) && (mode !== "label" || !inCoach))
  .refine(({ mode, inCoach, mealHistory }) => !mealHistory || (mode === "meal" && inCoach === true));

export type FoodPhotoRequest = z.infer<typeof foodPhotoRequestSchema>;
