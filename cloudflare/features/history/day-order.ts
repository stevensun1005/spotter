export function orderedOwnLogs<T extends { id: string; owner: string }>(logs: T[], owner: string, order: readonly string[]) {
  if (!order.length) return logs;
  const rank = new Map(order.map((id, index) => [id, index]));
  const own = logs.filter((log) => log.owner === owner).sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
  let index = 0;
  return logs.map((log) => log.owner === owner ? own[index++] : log);
}

export function moveHistoryId(ids: string[], id: string, direction: -1 | 1) {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
