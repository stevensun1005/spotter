import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const { loadAgentExerciseLibrary } = await import("../features/agent-access/exercise-library.ts");

test("the Agent reuses the same action from notes, plans, or history within the current account", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE personal_library(owner, kind, id, payload, updated); CREATE TABLE entries(owner, kind, payload, updated)");
  const preference = sqlite.prepare("INSERT INTO personal_library VALUES (?, 'exercise', ?, ?, 1)");
  preference.run("alice", "Dumbbell Bench Press", JSON.stringify({ item: { note: "keep my notes" } }));
  preference.run("alice", "Paused Pull", JSON.stringify({ item: { versionOf: "Pull-Up" } }));
  preference.run("bob", "Bob Only Exercise", JSON.stringify({ item: {} }));
  const write = sqlite.prepare("INSERT INTO entries VALUES (?, ?, ?, ?)");
  write.run("alice", "plan", JSON.stringify({ exercises: [{ name: "Cable Drop Press" }] }), 1);
  write.run("alice", "log", JSON.stringify({ plan: { exercises: [{ name: "Side Step Float" }, "unsupported"] } }), 2);
  write.run("bob", "plan", JSON.stringify({ exercises: [{ name: "Bob's Personal Drill" }] }), 3);
  write.run("alice", "draft", JSON.stringify({ exercises: [{ name: "Draft Only" }] }), 4);
  write.run("alice", "log", "unsupported historic format", 5);
  const db = { prepare: (sql) => ({ bind: (owner) => ({ all: async () => ({ results: sqlite.prepare(sql).all(owner) }) }) }) };
  const library = await loadAgentExerciseLibrary(db, "alice");
  assert.deepEqual(library.resolve("哑铃卧推"), { name: "Dumbbell Bench Press", catalogueId: "0289", source: "personal" });
  assert.deepEqual(library.resolve("Ｄｕｍｂｂｅｌｌ   Bench Press", "0289"), library.resolve("哑铃卧推"));
  assert.deepEqual(library.resolve("Dumbbell Incline Bench Press"), { name: "上斜哑铃卧推", catalogueId: "0314", source: "catalogue" });
  assert.equal(library.resolve("paused pull").name, "Paused Pull");
  assert.deepEqual(library.resolve("cable drop press"), { name: "Cable Drop Press", source: "personal" });
  assert.deepEqual(library.resolve("side step float"), { name: "Side Step Float", source: "personal" });
  assert.equal(library.resolve("cable drop press reverse").source, "new");
  assert.equal(library.resolve("A1 哑铃卧推（窄握）").catalogueId, undefined);
  assert.equal(library.resolve("Bob Only Exercise").source, "new");
  assert.equal(library.resolve("Bob's Personal Drill").source, "new");
  assert.equal(library.resolve("Draft Only").source, "new");
  assert.throws(() => library.resolve("哑铃卧推", "0314"), { status: 409 });
  assert.throws(() => library.resolve("哑铃卧推", "999999"), { status: 400 });
  assert.deepEqual(library.moves([{ name: "A1 cable drop press · 慢放", reps: 8, weight: 10, unit: "lb" }]), [
    { name: "Cable Drop Press", catalogueId: undefined, sourceSlot: "A1", cue: "慢放", reps: 8, weight: 10, unit: "lb" },
  ]);
});
