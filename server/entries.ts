import { database } from "./db";
import type { Entry } from "@/shared/state";

type Row = Omit<Entry, "data"> & { payload: string };

export function listEntries(owner: string, partner: string | null) {
  const rows = database().prepare(
    "SELECT id, owner, kind, payload, updated FROM entries " +
    "WHERE owner = ? OR (owner = ? AND kind IN ('plan', 'log', 'cheer')) ORDER BY updated DESC, rowid DESC"
  ).all(owner, partner) as Row[];
  return rows.map(({ payload, ...row }) => ({ ...row, data: JSON.parse(payload) }) as Entry)
    .filter((entry) => entry.kind !== "plan" || entry.owner === owner || entry.data.shared);
}

export function entryKind(owner: string, id: string) {
  return database().prepare("SELECT kind FROM entries WHERE owner = ? AND id = ?")
    .get(owner, id)?.kind;
}

export function saveEntry(owner: string, id: string, kind: Entry["kind"], data: Entry["data"]) {
  return database().prepare(
    "INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload, updated = excluded.updated " +
    "WHERE (entries.kind = 'draft' AND excluded.kind IN ('draft', 'log')) OR (entries.kind = 'plan' AND excluded.kind = 'plan')"
  ).run(owner, id, kind, JSON.stringify(data), new Date().toISOString()).changes > 0;
}
