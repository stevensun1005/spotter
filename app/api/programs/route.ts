import { requireAccount } from "@/server/account";
import { api, json, readJson } from "@/server/http";
import { programMutation } from "@/features/programs/model";
import { commitProgram, previewProgram, readPrograms, readRules, removeProgram, saveProgram, saveRules } from "@/features/programs/server";

export const dynamic = "force-dynamic";
export const GET = api(async () => {
  const { id: owner } = await requireAccount();
  const [programs, rules] = await Promise.all([readPrograms(owner), readRules(owner)]);
  return json({ programs, rules });
});
export const POST = api(async (request) => {
  const { id: owner } = await requireAccount();
  const value = await readJson(request, programMutation, 1_500_000);
  if (value.action === "save") return json({ program: await saveProgram(owner, value.program, value.revision) });
  if (value.action === "rules") return json(await saveRules(owner, value.rules, value.revision));
  if (value.action === "remove") return json(await removeProgram(owner, value.id, value.revision));
  if (value.action === "preview") return json(await previewProgram(owner, value.id, value.revision));
  return json(await commitProgram(owner, value.id, value.revision, value.previewToken, value.confirmed));
});
