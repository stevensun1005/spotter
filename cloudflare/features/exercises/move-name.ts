import corrections from "./catalog-corrections.json" with { type: "json" };

const correctedMoves: Record<string, { id: string; name: string; aliases: string[] }> = corrections;
export const exerciseIdentityNameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const names = new Map(Object.values(correctedMoves).flatMap(({ name, aliases }) =>
  aliases.map((alias) => [exerciseIdentityNameKey(alias), name] as const)));

export function canonicalMoveName(name: string) {
  return names.get(exerciseIdentityNameKey(name)) ?? name;
}

export function canonicalCatalogueId(id: string) {
  return correctedMoves[id]?.id ?? id;
}

const slotPattern = /^(?:([A-Z]\d+)\s+|([A-Z])\s+热身组\s*·\s*|(E)\s+(?![A-Za-z]))/;

export function parsePlanMove(value: string, { preserveQualifiers = false } = {}) {
  const match = slotPattern.exec(value.trim());
  if (!match) return { name: canonicalMoveName(value.trim()), cue: undefined, sourceSlot: undefined };
  const sourceSlot = match[1] ?? (match[2] ? match[2] + "-warmup" : match[3]);
  const result = value.trim().slice(match[0].length).match(/^(.+?)(?:（([^（）]+)）)?(?:\s*·\s*(.+))?$/);
  const name = result?.[1].trim() ?? value.trim();
  const qualifier = result?.[2];
  return {
    name: canonicalMoveName(preserveQualifiers && qualifier ? name + "（" + qualifier + "）" : name),
    cue: [preserveQualifiers ? undefined : qualifier, result?.[3]].filter(Boolean).join(" · ") || undefined,
    sourceSlot,
  };
}
