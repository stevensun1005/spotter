import { z } from "zod";
import { draftSessionSchema, hasCompletedWorkout, sessionSchema } from "@/features/training/model";
import { planSchema } from "@/features/plans/model";
import { libraryItem, uuid, type LibraryItem } from "@/features/library/model";
import { heartSchema } from "@/features/heart/model";
import { dateSchema } from "@/shared/dates";

export const dataScopes = ["all", "training", "nutrition", "body", "templates"] as const;
export const scopeSchema = z.enum(dataScopes);
export type DataScope = z.infer<typeof scopeSchema>;
export const backingFormat = "spotter-backup";
export const backupLimit = 8_000_000;
export const scopeNames: Record<DataScope, string> = { all: "全部数据", training: "训练", nutrition: "饮食", body: "身体", templates: "模板" };

const backupTraining = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), id: uuid, data: planSchema }),
  z.object({ kind: z.literal("draft"), id: uuid, data: draftSessionSchema }),
  z.object({ kind: z.literal("log"), id: uuid, data: sessionSchema }),
]);
export const backupSchema = z.object({
  format: z.literal(backingFormat),
  version: z.literal(1),
  training: z.array(backupTraining).max(25_000),
  library: z.array(libraryItem).max(25_000),
  heart: z.array(z.object({ id: uuid, data: heartSchema })).max(25_000),
}).superRefine((file, ctx) => {
  if (file.training.some((row) => row.kind === "log" && !hasCompletedWorkout(row.data))) {
    ctx.addIssue({ code: "custom", path: ["training"], message: "打卡需要包含完成的组、视频或有氧训练时长。" });
  }
});
export type Backup = z.infer<typeof backupSchema>;

export const dateBounds = z.object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .refine(({ from, to }) => !from || !to || from <= to);
export type DateBounds = z.infer<typeof dateBounds>;

export function libraryScope(item: LibraryItem): DataScope {
  if (item.kind === "template") return "templates";
  if (item.kind === "body-profile") return "body";
  if (item.kind === "nutrition") return item.entry.type === "weight" || item.entry.type === "measurement" ? "body" : "nutrition";
  if (item.kind === "targets" || item.kind === "food" || item.kind === "food-portions") return "nutrition";
  return "training";
}

export function scopeBackup(file: Backup, scope: DataScope): Backup {
  if (scope === "all") return file;
  return { ...file, training: scope === "training" ? file.training : [],
    library: file.library.filter((item) => libraryScope(item) === scope), heart: scope === "training" ? file.heart : [] };
}

export const emptyBackup = (): Backup => ({ format: backingFormat, version: 1, training: [], library: [], heart: [] });

export function libraryKey(item: LibraryItem) {
  if (item.kind === "exercise") return item.item.name;
  return "id" in item ? item.id : item.kind;
}
