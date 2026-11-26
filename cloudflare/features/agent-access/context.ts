import catalogue from "@/public/open-gym/index.json" with { type: "json" };
import { agentProfileRef } from "@/features/agent/profile";
import { blankProfile } from "@/features/library/model";
import { readPrograms, readRules } from "@/features/programs/server";
import { agentExerciseNameKey, readUsedExerciseNames } from "./exercise-library";

const normalize = (value: string) => value.toLowerCase().normalize("NFKC");
export async function planningContext(db: D1Database, owner: string, query: { query: string; offset: number; limit: number }) {
  const rows = db.prepare("SELECT kind, payload FROM personal_library WHERE owner = ? AND kind IN ('exercise', 'template') ORDER BY kind, id").bind(owner).all<{ kind: string; payload: string }>();
  const [{ results }, used] = await Promise.all([rows, readUsedExerciseNames(db, owner)]);
  const term = normalize(query.query);
  const items = results.map((row) => JSON.parse(row.payload));
  const known = new Set(items.filter((row) => row.kind === "exercise").map((row) => agentExerciseNameKey(row.item.name)));
  for (const name of used) {
    const key = agentExerciseNameKey(name);
    if (known.has(key)) continue;
    known.add(key);
    items.push({ kind: "exercise", item: blankProfile(name) });
  }
  const personal = items.filter((row) => !term || normalize(row.kind === "exercise" ? row.item.name : row.plan.title).includes(term));
  const page = personal.slice(query.offset, query.offset + query.limit);
  const builtIn = catalogue.rows.filter((row) => !term || normalize([row.name, row.en, row.equipment, row.part].join(" ")).includes(term));
  const [rules, programs] = await Promise.all([readRules(owner, db), readPrograms(owner, db)]);
  return {
    profileRef: await agentProfileRef(owner),
    rules,
    personalExercises: page.filter((row) => row.kind === "exercise").map((row) => row.item),
    templates: page.filter((row) => row.kind === "template"),
    nextOffset: query.offset + query.limit < personal.length ? query.offset + query.limit : null,
    catalogue: { items: builtIn.slice(query.offset, query.offset + query.limit).map(({ id, name, en, part, equipment, type }) => ({ id, name, en, part, equipment, type })), nextOffset: query.offset + query.limit < builtIn.length ? query.offset + query.limit : null },
    programs: programs.map((item) => ({ id: item.id, title: item.title, revision: item.revision })),
    constraints: { maxPlansPerDraft: 20, privateByDefault: true, unknownWeight: 0, allowedWrites: "Stage a plan or program, review it, then commit only after the user's authorization. Existing logs and in-progress workouts are never overwritten." },
  };
}
