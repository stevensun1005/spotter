import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { parsePlanMove } from "@/features/exercises/move-name";
import { demoMaxBase64, removePersonalDemo, savePersonalDemo } from "@/features/exercises/personal-demo";
import { HttpError } from "@/server/http";
import { loadAgentExerciseLibrary } from "./exercise-library";
import type { AgentPrincipal } from "./model";
import { requireScope, verifyProfile } from "./store";

const common = { profileRef: profileRefSchema, name: z.string().trim().min(1).max(100), confirmed: z.literal(true) };
export const exerciseDemoInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), ...common, gifBase64: z.string().min(1).max(demoMaxBase64) }).strict(),
  z.object({ action: z.literal("remove"), ...common }).strict(),
]);

export async function changeAgentExerciseDemo(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof exerciseDemoInput>) {
  requireScope(principal, "exercise-demos:write");
  await verifyProfile(principal.owner, input.profileRef);
  if (input.action === "remove") return { action: input.action, ...await removePersonalDemo(db, principal.owner, input.name) };
  requireScope(principal, "read:context");
  const exercise = (await loadAgentExerciseLibrary(db, principal.owner)).resolve(parsePlanMove(input.name).name);
  if (exercise.source === "catalogue") throw new HttpError(400, "动作库已有同一个内置动作。请使用它已有的动作示范。");
  return { action: input.action, ...await savePersonalDemo(db, principal.owner, exercise.name, input.gifBase64) };
}

const properties = { profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
  name: { type: "string", minLength: 1, maxLength: 100 }, confirmed: { const: true } };
const required = ["action", "profileRef", "name", "confirmed"];
export const exerciseDemoTool = {
  name: "manage_spotter_exercise_demo",
  description: "Save, replace or remove a private GIF for a custom exercise. Saving requires read:context. Search the exercise library and reuse an exact personal match. Use the existing demonstration when the exact exercise is built in. Ask whether to attach this specific GIF and send confirmed:true after the user agrees. Send raw base64 GIF (no URL or data prefix), up to 768 KiB, 480 px per side, and 2–90 frames.",
  inputSchema: { type: "object", oneOf: [
    { type: "object", additionalProperties: false, required: [...required, "gifBase64"],
      properties: { ...properties, action: { const: "save" }, gifBase64: { type: "string", minLength: 1, maxLength: demoMaxBase64 } } },
    { type: "object", additionalProperties: false, required,
      properties: { ...properties, action: { const: "remove" } } },
  ] },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};
