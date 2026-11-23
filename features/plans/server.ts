import { z } from "zod";
import { database, transaction } from "@/server/db";
import { saveEntry } from "@/server/entries";
import { HttpError } from "@/server/http";
import { planSchema, type PlannedWorkout } from "./model";

export const plansMutation = z.object({
  items: z.array(z.object({ id: z.string().uuid(), data: planSchema })).min(1).max(20),
});

export function savePlans(owner: string, items: PlannedWorkout[]) {
  transaction(database(), () => {
    for (const item of items) {
      if (!saveEntry(owner, item.id, "plan", item.data)) throw new HttpError(409, "这个计划编号已存在。");
    }
  });
}
