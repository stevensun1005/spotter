import { emptyBackup } from "@/features/data/model";
import type { LibraryItem } from "@/features/library/model";
import { send } from "@/shared/client";

export async function saveMealRecords(library: Extract<LibraryItem, { kind: "nutrition" }>[]) {
  const response = await send("/api/data", { ...emptyBackup(), library });
  return response.json() as Promise<{ added: number; skipped: number }>;
}
