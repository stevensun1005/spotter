const slotPattern = /^(?:([A-Z]\d+)\s+|([A-Z])\s+热身组\s*·\s*|(E)\s+(?![A-Za-z]))/;

export function parsePlanMove(value: string) {
  const match = slotPattern.exec(value.trim());
  if (!match) return { name: value.trim(), cue: undefined, sourceSlot: undefined };
  const sourceSlot = match[1] ?? (match[2] ? match[2] + "-warmup" : match[3]);
  const result = value.trim().slice(match[0].length).match(/^(.+?)(?:（([^（）]+)）)?(?:\s*·\s*(.+))?$/);
  return {
    name: result?.[1].trim() ?? value.trim(),
    cue: [result?.[2], result?.[3]].filter(Boolean).join(" · ") || undefined,
    sourceSlot,
  };
}
