import { z } from "zod";
import { mealTypes } from "@/features/library/model";
import { proteinProductSchema } from "@/features/training/protein";
import { send } from "@/shared/client";
import { dateSchema } from "@/shared/dates";
import { mealPhotoDraftSchema } from "./food-photo-model";

const proteinPayload = {
  product: proteinProductSchema,
  addToWarehouse: z.boolean(),
  records: z.array(z.object({
    id: z.string().uuid(),
    date: dateSchema,
    meal: z.enum(mealTypes),
    draft: mealPhotoDraftSchema.optional(),
  }).strict()).max(2),
};

export const coachProteinRequest = z.object({
  expectedOwner: z.string().trim().min(1).max(120),
  ...proteinPayload,
}).strict().refine(({ addToWarehouse, records }) =>
  (addToWarehouse || records.length > 0) && new Set(records.map(({ id }) => id)).size === records.length &&
  new Set(records.map(({ date }) => date)).size === records.length);

export type CoachProteinRequest = z.infer<typeof coachProteinRequest>;
export type CoachProteinSubmission = Omit<CoachProteinRequest, "expectedOwner"> & { owner: string };
export type CoachProteinReceipt = { warehouse: "added" | "existing" | null; recorded: number; defaultProductId?: string };

export async function saveCoachProtein({ owner, ...submission }: CoachProteinSubmission): Promise<CoachProteinReceipt> {
  const parsed = coachProteinRequest.safeParse({ expectedOwner: owner, ...submission });
  if (!parsed.success) throw new Error("请核对蛋白粉、日期和需要保存的项目。");
  const response = await send("/api/coach-protein", parsed.data);
  return response.json() as Promise<CoachProteinReceipt>;
}
