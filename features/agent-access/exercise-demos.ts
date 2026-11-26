import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { demoMaxBase64, removePersonalDemo, savePersonalDemo } from "@/features/exercises/personal-demo";
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
  const result = input.action === "save" ? await savePersonalDemo(db, principal.owner, input.name, input.gifBase64)
    : await removePersonalDemo(db, principal.owner, input.name);
  return { action: input.action, ...result };
}

const properties = { profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
  name: { type: "string", minLength: 1, maxLength: 100 }, confirmed: { const: true } };
const required = ["action", "profileRef", "name", "confirmed"];
export const exerciseDemoTool = {
  name: "manage_spotter_exercise_demo",
  description: "Save, replace or remove a private demonstration GIF for a named exercise. Ask whether the user wants this specific GIF attached when importing a custom exercise. Use confirmed:true only after the user agrees. Send raw base64 GIF (no URL or data prefix), up to 768 KiB, 480 px per side, and 2–90 frames.",
  inputSchema: { type: "object", oneOf: [
    { type: "object", additionalProperties: false, required: [...required, "gifBase64"],
      properties: { ...properties, action: { const: "save" }, gifBase64: { type: "string", minLength: 1, maxLength: demoMaxBase64 } } },
    { type: "object", additionalProperties: false, required,
      properties: { ...properties, action: { const: "remove" } } },
  ] },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};
