import { send } from "@/shared/client";
import { cleanPlan, type PlannedWorkout } from "./model";

export async function savePlanBatch(items: PlannedWorkout[]) {
  const validated = items.map(({ id, data }, index) => {
    const result = cleanPlan(data);
    if (!result.success) throw new Error("请检查第 " + (index + 1) + " 个计划的名称、日期、动作和视频链接。");
    return { id, data: result.data };
  });
  await send("/api/plans", { items: validated });
}
