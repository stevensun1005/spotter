import { z } from "zod";
import { entryKind, saveEntry } from "@/server/entries";
import { HttpError } from "@/server/http";
import { sessionSchema, sessionTotals } from "./model";

export const trainingMutation = z.object({
  action: z.enum(["draft", "log"]),
  id: z.string().uuid(),
  data: sessionSchema,
});

export function recordTraining(owner: string, { action, id, data }: z.infer<typeof trainingMutation>) {
  if (data.finishedVideo && !data.plan.video) throw new HttpError(400, "这次训练没有视频链接。");
  if (action === "log" && !data.finishedVideo && !sessionTotals(data).sets) {
    throw new HttpError(400, "请至少完成一组动作或标记视频跟练完成。");
  }
  const stored = saveEntry(owner, id, action, data);
  if (!stored && !(action === "log" && entryKind(owner, id) === "log")) {
    throw new HttpError(409, "此训练已打卡或编号冲突，草稿不能继续修改。");
  }
}
