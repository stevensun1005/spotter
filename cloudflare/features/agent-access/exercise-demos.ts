import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { demoMaxBase64, demoMaxBytes, readPersonalDemo, removePersonalDemo, savePersonalDemo } from "@/features/exercises/personal-demo";
import { spotterCatalogueVideo } from "@/features/exercises/catalogue-video";
import { HttpError } from "@/server/http";
import { loadAgentExerciseLibrary } from "./exercise-library";
import type { AgentPrincipal } from "./model";
import { requireScope, verifyProfile } from "./store";

const identity = { profileRef: profileRefSchema, name: z.string().trim().min(1).max(100) };
const common = { ...identity, confirmed: z.literal(true) };
export const exerciseDemoInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), ...common, gifBase64: z.string().min(1).max(demoMaxBase64) }).strict(),
  z.object({ action: z.literal("remove"), ...common }).strict(),
]);
const catalogueIdPattern = /^\d{4,6}$/;
export const exerciseDemoSkillInput = z.object({ ...identity, catalogueId: z.string().trim().regex(catalogueIdPattern).optional() }).strict();

const demoSkill = {
  name: "spotter-exercise-demo",
  downloadUrl: "/spotter-demo-skill/spotter-exercise-demo.zip",
  instructionsPath: "spotter-exercise-demo/SKILL.md",
  rendererPath: "spotter-exercise-demo/renderer.html",
  instructions: "Resolve the download URL against the configured Spotter origin. Read SKILL.md and run the renderer in your tool runtime or browser. The renderer needs only exercise instructions, never credentials or private records.",
};
const uploadLimits = { maxBytes: demoMaxBytes, maxDimensionPixels: 480, minFrames: 2, maxFrames: 90, maxFramePixels: 9_000_000 };

export async function getAgentExerciseDemoSkill(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof exerciseDemoSkillInput>) {
  requireScope(principal, "read:context");
  await verifyProfile(principal.owner, input.profileRef);
  const exercise = (await loadAgentExerciseLibrary(db, principal.owner)).resolve(input.name, input.catalogueId, { requireExactName: true });
  if (exercise.catalogueId) {
    const mediaUrl = spotterCatalogueVideo(exercise.catalogueId);
    return { action: "reuse_catalogue", exercise,
      ...(mediaUrl ? { mediaUrl } : { skill: demoSkill }),
      instructions: "Reuse this catalogue identity in the plan. Its existing demonstration appears through Spotter. Do not create a duplicate or upload a private replacement. If a standalone preview is needed and the approved media link is absent, use the skill locally.",
    };
  }
  const upload = {
    tool: exerciseDemoTool.name, path: "/api/agent/exercise-demos", action: "save",
    scope: "exercise-demos:write", authorized: principal.scopes.includes("exercise-demos:write"),
    requireConfirmation: true, inputEncoding: "base64", ...uploadLimits,
  };
  if (exercise.source === "personal" && await readPersonalDemo(db, principal.owner, exercise.name)) {
    return { action: "reuse_personal", exercise, skill: demoSkill, upload,
      instructions: "Reuse the existing personal exercise and its Spotter demonstration. If the user confirms a replacement, generate a GIF with the skill and use the confirmed private upload.",
    };
  }
  return { action: "render_personal", exercise, skill: demoSkill, upload };
}

export async function changeAgentExerciseDemo(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof exerciseDemoInput>) {
  requireScope(principal, "exercise-demos:write");
  await verifyProfile(principal.owner, input.profileRef);
  if (input.action === "remove") return { action: input.action, ...await removePersonalDemo(db, principal.owner, input.name) };
  requireScope(principal, "read:context");
  const exercise = (await loadAgentExerciseLibrary(db, principal.owner)).resolve(input.name);
  if (exercise.catalogueId) throw new HttpError(400, "动作库已有同一个内置动作。请使用它已有的动作示范。");
  return { action: input.action, ...await savePersonalDemo(db, principal.owner, exercise.name, input.gifBase64) };
}

const properties = { profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
  name: { type: "string", minLength: 1, maxLength: 100 }, confirmed: { const: true } };
const required = ["action", "profileRef", "name", "confirmed"];
export const exerciseDemoSkillTool = {
  name: "get_spotter_exercise_demo_skill",
  description: "Read Spotter's demonstration instructions for an exact exercise after the user requests a demonstration. Requires read:context. Look up the exercise library first. Return approved catalogue media if available. For a new personal exercise, download and run the portable renderer, then use the private GIF upload with user confirmation. This tool does not render or save media.",
  inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "name"], properties: {
    profileRef: properties.profileRef, name: properties.name, catalogueId: { type: "string", pattern: catalogueIdPattern.source },
  } },
  annotations: { readOnlyHint: true, destructiveHint: false },
};
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
