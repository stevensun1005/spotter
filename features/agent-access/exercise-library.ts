import catalogue from "@/public/open-gym/index.json" with { type: "json" };
import { catalogueExerciseByExactName, catalogueExerciseById } from "@/features/exercises/catalogue-identity";
import { canonicalMoveName, exerciseIdentityNameKey, parsePlanMove } from "@/features/exercises/move-name";
import { planSchema, type Plan } from "@/features/plans/model";
import { HttpError } from "@/server/http";

export function agentExerciseNameKey(name: string) {
  return exerciseIdentityNameKey(parsePlanMove(name, { preserveQualifiers: true }).name);
}

type Match = { name: string; catalogueId?: string; source: "personal" | "catalogue" | "new" };
type NamedMove = { name: string; catalogueId?: string; cue?: string; sourceSlot?: string };

export async function readUsedExerciseNames(db: D1Database, owner: string) {
  const { results } = await db.prepare(
    "SELECT json_extract(move.value, '$.name') AS name FROM entries " +
    "JOIN json_each(CASE WHEN json_valid(payload) THEN json_extract(payload, CASE kind " +
    "WHEN 'plan' THEN '$.exercises' ELSE '$.plan.exercises' END) END) AS move " +
    "WHERE owner = ? AND kind IN ('plan', 'log') AND move.type = 'object' " +
    "GROUP BY name ORDER BY MAX(updated) DESC, name",
  ).bind(owner).all<{ name: unknown }>();
  return results.flatMap(({ name }) => {
    if (typeof name !== "string" || !name.trim()) return [];
    const parsed = parsePlanMove(name, { preserveQualifiers: true }).name;
    return parsed.length <= 100 && catalogueExerciseByExactName(catalogue, parsed) === undefined ? [parsed] : [];
  });
}

export async function loadAgentExerciseLibrary(db: D1Database, owner: string) {
  const profiles = db.prepare(
    "SELECT id, json_extract(payload, '$.item.versionOf') AS version_of " +
    "FROM personal_library WHERE owner = ? AND kind = 'exercise' ORDER BY updated DESC, id",
  ).bind(owner).all<{ id: string; version_of: string | null }>();
  const [{ results }, used] = await Promise.all([profiles, readUsedExerciseNames(db, owner)]);
  const personalByName = new Map<string, Match>();
  const personalByCatalogue = new Map<string, Match>();
  for (const { id, version_of: versionOf } of results) {
    const name = canonicalMoveName(id);
    // A named personal variant has its own identity, even when it was based on a catalogue action.
    const catalogueId = versionOf ? undefined : catalogueExerciseByExactName(catalogue, name)?.id;
    const match: Match = { name, catalogueId, source: "personal" };
    const key = agentExerciseNameKey(name);
    if (!personalByName.has(key)) personalByName.set(key, match);
    if (catalogueId && !personalByCatalogue.has(catalogueId)) personalByCatalogue.set(catalogueId, match);
  }
  for (const name of used) {
    const key = agentExerciseNameKey(name);
    if (!personalByName.has(key)) personalByName.set(key, { name, source: "personal" });
  }

  function resolve(name: string, catalogueId?: string): Match {
    const personal = personalByName.get(agentExerciseNameKey(name));
    const named = catalogueExerciseByExactName(catalogue, name);
    const chosen = catalogueId ? catalogueExerciseById(catalogue, catalogueId) : named;
    if (catalogueId && !chosen) throw new HttpError(400, "动作 ID 在 Spotter 动作库里不存在。请先读取动作库并使用实际 ID。");
    if (catalogueId && chosen && ((named && named.id !== chosen.id) || (personal && personal.catalogueId !== chosen.id))) {
      throw new HttpError(409, "动作名称与动作 ID 指向不同动作。请先读取动作库并核对。");
    }
    if (personal) return personal;
    if (chosen === null) throw new HttpError(409, "动作库有多个同名动作。请核对器械及动作要求，再提交准确的动作 ID。");
    if (chosen) return personalByCatalogue.get(chosen.id) ?? { name: chosen.name, catalogueId: chosen.id, source: "catalogue" };
    return { name: parsePlanMove(name, { preserveQualifiers: true }).name, source: "new" };
  }

  function moves<T extends NamedMove>(items: readonly T[]): T[] {
    return items.map((item) => {
      const match = resolve(item.name, item.catalogueId);
      if (item.name === match.name && item.catalogueId === match.catalogueId) return item;
      const { sourceSlot, cue } = parsePlanMove(item.name, { preserveQualifiers: true });
      return { ...item, name: match.name, catalogueId: match.catalogueId,
        ...(sourceSlot && !item.sourceSlot ? { sourceSlot } : {}), ...(cue && !item.cue ? { cue } : {}) };
    });
  }

  return { resolve, moves };
}

export async function resolveAgentPlanExercises(db: D1Database, owner: string, plans: readonly Plan[]): Promise<Plan[]> {
  if (!plans.some((plan) => plan.exercises.length)) return [...plans];
  const library = await loadAgentExerciseLibrary(db, owner);
  return plans.map((plan) => {
    const exercises = library.moves(plan.exercises);
    return exercises.every((move, index) => move === plan.exercises[index]) ? plan : planSchema.parse({ ...plan, exercises });
  });
}
