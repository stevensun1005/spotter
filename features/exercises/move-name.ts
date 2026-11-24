import corrections from "./catalog-corrections.json" with { type: "json" };

const correctedMoves: Record<string, { id: string; name: string; aliases: string[] }> = corrections;
const nameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const names = new Map(Object.values(correctedMoves).flatMap(({ name, aliases }) =>
  aliases.map((alias) => [nameKey(alias), name] as const)));

export function canonicalMoveName(name: string) {
  return names.get(nameKey(name)) ?? name;
}

export function canonicalCatalogueId(id: string) {
  return correctedMoves[id]?.id ?? id;
}

const slotPattern = /^(?:([A-Z]\d+)\s+|([A-Z])\s+热身组\s*·\s*|(E)\s+(?![A-Za-z]))/;

export function parsePlanMove(value: string) {
  const match = slotPattern.exec(value.trim());
  if (!match) return { name: canonicalMoveName(value.trim()), cue: undefined, sourceSlot: undefined };
  const sourceSlot = match[1] ?? (match[2] ? match[2] + "-warmup" : match[3]);
  const result = value.trim().slice(match[0].length).match(/^(.+?)(?:（([^（）]+)）)?(?:\s*·\s*(.+))?$/);
  return {
    name: canonicalMoveName(result?.[1].trim() ?? value.trim()),
    cue: [result?.[2], result?.[3]].filter(Boolean).join(" · ") || undefined,
    sourceSlot,
  };
}
