import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { applyLoadSuggestion, buildLoadHistory, recommendLoads } = await import("../features/training/load-progression.ts");
const trainingMove = (extra = {}) => ({ name: "哑铃交替二头弯举", catalogueId: "0285", sets: 4, weight: 30, unit: "lb", reps: 8, seconds: 0, ...extra });
const completed = (weight, reps, extra = {}) => ({ weight, reps, seconds: 0, done: true, ...extra });
const pending = (weight = 30, reps = 8) => ({ weight, reps, seconds: 0, done: false });
const history = (entries = []) => buildLoadHistory(entries, "me");
const log = (move, rows, date, extra = {}) => ({ id: date, owner: "me", kind: "log", updated: date,
  data: { date, started: Date.parse(date), plan: { category: "力量训练", exercises: [move] }, rows: [rows] }, ...extra });

test("proven higher load is reused across plans by canonical ID, excluding other people and drafts", () => {
  const prior = trainingMove({ name: "杠铃二头交替弯举", catalogueId: "0023", sets: 3 });
  const move = trainingMove();
  const cardio = log(move, [completed(90, 10)], "2026-11-21");
  cardio.data.plan.category = "有氧训练";
  const entries = [
    cardio,
    log(move, [completed(80, 10)], "2026-11-20", { owner: "buddy" }),
    log(move, [completed(65, 10)], "2026-11-19", { kind: "draft" }),
    log(prior, [completed(25, 8), completed(25, 8), completed(35, 8)], "2026-11-18"),
    log(trainingMove({ catalogueId: "0030" }), [completed(55, 10)], "2026-11-17"),
  ];
  const rows = Array.from({ length: 4 }, () => pending());
  assert.deepEqual(recommendLoads(move, rows, history(entries)), rows.map(() => ({ weight: 35, reason: "history" })));
  assert.ok(rows.every((row) => row.weight === 30 && !row.done));
});

test("legacy plan names use exact normalized identity, without merging different exercises", () => {
  const current = trainingMove({ name: "Cable Triceps Pushdown", catalogueId: undefined, unit: "kg" });
  const legacy = { ...current, name: "A1 ＣＡＢＬＥ   triceps pushdown" };
  const kg = history([
    log({ ...current, name: "Kneeling Cable Triceps Pushdown" }, [completed(60, 8)], "2026-11-20"),
    log(legacy, [completed(45, 8)], "2026-11-19"),
  ]);
  assert.deepEqual(recommendLoads(current, [pending()], kg), [{ weight: 45, reason: "history" }]);
  assert.deepEqual(recommendLoads({ ...current, name: "Cable Triceps Extension" }, [pending()], kg), [null]);
});

test("working-set positions skip warm-up and drop sets and preserve a descending load profile", () => {
  const move = trainingMove();
  const entries = [
    log({ ...move, block: "W" }, [completed(70, 10)], "2026-11-21"),
    log(move, [completed(25, 8, { kind: "warmup" }), completed(45, 8), completed(40, 8),
      completed(20, 12, { kind: "drop" }), pending(), completed(35, 10)], "2026-11-19"),
  ];
  const rows = [{ ...pending(), kind: "warmup" }, pending(), pending(), pending(), pending()];
  assert.deepEqual(recommendLoads(move, rows, history(entries)).map((item) => item?.weight), [undefined, 45, 40, 35, 35]);
});

test("one-rep overload immediately backs off and is not reused next time", () => {
  const move = trainingMove({ repsMax: 12 });
  const get = (rows, entries) => recommendLoads(move, rows, history(entries));
  const poor = [completed(30, 12), completed(35, 1)];
  assert.deepEqual(get([...poor, pending(), pending()]), [null, null, { weight: 30, reason: "backoff" }, null]);
  assert.deepEqual(get([pending()], [log(move, poor, "2026-11-19")]), [{ weight: 30, reason: "history" }]);
  assert.equal(get([pending()], [log(move, [completed(35, 1)], "2026-11-19")])[0], null);
  assert.deepEqual(get([completed(35, 4), pending()], [log(move, [completed(30, 10)], "2026-11-19")]),
    [null, { weight: 30, reason: "backoff" }]);
  assert.equal(get([completed(32.5, 1), ...Array.from({ length: 3 }, () => completed(30, 12)), pending()]).at(-1), null);
});

test("a failed recent overload stays on cooldown until another workout proves the baseline", () => {
  const move = trainingMove({ repsMax: 12 });
  const stable = Array.from({ length: 3 }, () => completed(30, 12));
  const recentFailure = log(move, [...stable, completed(32.5, 1)], "2026-11-19");
  const current = [...stable, pending()];
  assert.equal(recommendLoads(move, current, history([recentFailure])).at(-1), null);
  const onlyFailed = log(move, [completed(32.5, 1)], "2026-11-21");
  const olderSolid = log(move, stable, "2026-11-18");
  assert.equal(recommendLoads(move, current, history([onlyFailed, olderSolid])).at(-1), null);
  const recovery = log(move, stable, "2026-11-22");
  assert.deepEqual(recommendLoads(move, current, history([recovery, recentFailure])).at(-1),
    { weight: 32.5, reason: "increase" });
});

test("fourth set increases following three repeatable top-range or fixed-rep sets", () => {
  const move = trainingMove({ repsMax: 12 });
  const three = (reps, extra) => Array.from({ length: 3 }, () => completed(30, reps, extra));
  const get = (move, rows, step) => recommendLoads(move, [...rows, pending()], history(), step).at(-1);
  assert.deepEqual(get(move, three(12)), { weight: 32.5, reason: "increase" });
  assert.deepEqual(get({ ...move, repsMax: undefined }, three(8)), { weight: 32.5, reason: "increase" });
  assert.deepEqual(get(move, three(9, { rpe: 7 }), 1), { weight: 31, reason: "increase" });
  assert.equal(get(move, three(11)), null);
  assert.equal(get(move, [...three(12).slice(0, 2), completed(30, 12, { rpe: 9 })]), null);
  assert.equal(get(move, three(12), 5), null);
  assert.equal(get(move, [...three(12).slice(0, 2), completed(30, 12, { kind: "warmup" })]), null);
  assert.equal(get({ ...move, fixedLoad: true }, three(12)), null);
  assert.equal(get({ ...move, loadPercent: { percent: 70, reference: 50, unit: "lb" } }, three(12)), null);
});

test("heavier working sets are offered for carryover while RPE and actual records retain their values", () => {
  const move = trainingMove({ repsMax: 12 });
  const actual = completed(40, 9, { rpe: 8.5 });
  const rows = [actual, pending(), pending()];
  const result = recommendLoads(move, rows, history());
  assert.deepEqual(result, [null, { weight: 40, reason: "current" }, null]);
  const applied = applyLoadSuggestion(rows[1], result[1]);
  assert.deepEqual(applied, { ...rows[1], weight: 40 });
  assert.equal(applyLoadSuggestion(actual, result[1]), actual);
  assert.deepEqual(recommendLoads(move, [actual, applied, pending()], history()), [null, null, null]);
});

test("per-side loads preserve both actual weights, and the weaker side controls progression", () => {
  const move = trainingMove({ unit: "kg", repsMax: 12 });
  const reps = 12;
  const rows = Array.from({ length: 3 }, () => completed(25, reps, { right: { weight: 30, reps } }));
  const next = { ...pending(25), right: { weight: 30, reps: 8 } };
  const hint = recommendLoads(move, [...rows, next], history()).at(-1);
  assert.deepEqual(hint, { weight: 27.5, rightWeight: 32.5, reason: "increase" });
  assert.deepEqual(applyLoadSuggestion(next, hint), { ...next, weight: 27.5, right: { weight: 32.5, reps: 8 } });

  const failRight = completed(24, 12, { right: { weight: 35, reps: 1 } });
  assert.deepEqual(recommendLoads(move, [rows[0], failRight, next], history()).at(-1),
    { weight: 24, rightWeight: 30, reason: "backoff" });
  assert.deepEqual(recommendLoads(move, [next], history([log(move, [...rows, failRight], "2026-11-19")])),
    [{ weight: 25, rightWeight: 30, reason: "history" }]);

  const pounds = { ...move, unit: "lb" };
  const baseline = recommendLoads(move, [next], history([log(pounds, [completed(45, 12, { right: { weight: 50, reps } })], "2026-11-19")]))[0];
  assert.deepEqual(baseline, { weight: 20.41, rightWeight: 22.68, reason: "history" });
});
