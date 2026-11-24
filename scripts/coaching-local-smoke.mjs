// Synthetic HTTP verification against a built, loopback-only Worker preview.
// The identity headers model Sites dispatch; they are not a hosted sign-in test.
import assert from "node:assert/strict";

const target = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Use only a loopback HTTP Worker preview with disposable local D1 data.");
}
const base = target.origin;
const actor = (name) => ({ id: "synthetic-" + crypto.randomUUID(), name });
const coach = actor("合成教练");
const student = actor("合成学员");
const other = actor("合成第三账号");
const plan = { title: "合成教练力量训练", date: "2026-12-01", category: "力量训练", minutes: 30,
  shared: false, video: "", exercises: [{ name: "哑铃卧推", sets: 2, reps: 8, weight: 15, unit: "kg", seconds: 0, targetRpe: 7.5 }] };

async function call(who, path, body, expected = 200, origin = base) {
  const response = await fetch(base + path, { redirect: "error", signal: AbortSignal.timeout(20_000),
    headers: { ...(who ? { "oai-authenticated-user-id": who.id, "oai-authenticated-user-email": "synthetic@example.invalid",
      "oai-authenticated-user-full-name": encodeURIComponent(who.name), "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8" } : {}),
    ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  const accepted = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  assert.ok(accepted, `${path} expected ${expected}, got ${response.status}: ${data.error ?? "non-JSON response"}`);
  return data;
}
const post = (who, body, expected, origin) => call(who, "/api/coaching", body, expected, origin);
const home = (who) => call(who, "/api/coaching");
const detail = (who, id, expected) => call(who, "/api/coaching?assignment=" + id, undefined, expected);

async function connect(teacher, learner) {
  const { invite } = await post(teacher, { action: "invite" });
  const inspected = await post(learner, { action: "inspectInvite", code: invite.code });
  assert.equal(inspected.coachName, teacher.name);
  const { link } = await post(learner, { action: "join", code: invite.code, confirmed: true, shareDetails: false });
  await post(other, { action: "join", code: invite.code, confirmed: true, shareDetails: false }, [403, 404, 409]);
  return link;
}
async function sourceFor(teacher, title = plan.title) {
  const id = crypto.randomUUID();
  await call(teacher, "/api/library", { action: "save", data: { kind: "template", id, plan: { ...plan, title } } });
  const { source } = await call(teacher, "/api/coaching?sourceKind=template&sourceId=" + id);
  return { kind: source.kind, id: source.id, expectedHash: source.expectedHash };
}
async function send(teacher, link, source, note = "合成教练说明") {
  const body = { action: "send", linkId: link.id, requestId: crypto.randomUUID(), source, startDate: "2026-12-03", note };
  const first = await post(teacher, body);
  assert.equal((await post(teacher, body)).assignment.id, first.assignment.id, "same request must not send twice");
  return first.assignment;
}
async function accept(learner, assignment, teacher) {
  const { preview } = await post(learner, { action: "preview", assignmentId: assignment.id });
  const body = { action: "accept", assignmentId: assignment.id, revision: preview.revision, previewToken: preview.token, confirmed: true };
  if (teacher) await post(teacher, body, [403, 404]);
  const first = await post(learner, body);
  assert.equal(first.result.added, 1);
  assert.equal((await post(learner, body)).result.added, 1, "receipt replay keeps its original result");
  return body;
}
async function complete(learner, assignment) {
  const received = await detail(learner, assignment.id);
  const session = received.program.sessions[0];
  const started = Date.now();
  const data = { plan: session.plan, planId: session.id, date: session.plan.date, started,
    ended: started + 1_200_000, minutes: 20, note: "PRIVATE_LOCAL_NOTE", proteinShake: true, finishedVideo: false,
    rows: session.plan.exercises.map((move) => Array.from({ length: move.sets }, () => ({ weight: 17.5, reps: 8, seconds: 0, rpe: 8, done: true }))) };
  await call(learner, "/api/workout", { action: "log", id: crypto.randomUUID(), data });
  return session.id;
}

await call(null, "/api/coaching", undefined, 401);
await post(coach, { action: "invite" }, 403, "https://untrusted.invalid");
const link = await connect(coach, student);
const source = await sourceFor(coach);
await post(coach, { action: "send", linkId: link.id, requestId: crypto.randomUUID(), source: { ...source, expectedHash: "f".repeat(64) }, startDate: "2026-12-03", note: "" }, 409);
const assignment = await send(coach, link, source);
await detail(other, assignment.id, [403, 404]);
const acceptedBody = await accept(student, assignment, coach);
await complete(student, assignment);
const hidden = await detail(coach, assignment.id);
assert.equal(hidden.assignment.progress.completed, 1);
assert.equal(hidden.sessions[0].actual, null);
await post(student, { action: "sharing", linkId: link.id, shareDetails: true });
const shared = await detail(coach, assignment.id);
assert.equal(shared.sessions[0].actual.exercises[0].sets[0].weight, 17.5);
assert.equal(JSON.stringify(shared).includes("PRIVATE_LOCAL_NOTE"), false);
assert.equal(JSON.stringify(shared).includes("proteinShake"), false);
await post(student, { action: "feedback", assignmentId: assignment.id, note: "合成反馈：已完成本次训练。" });
assert.equal((await detail(coach, assignment.id)).feedback.note, "合成反馈：已完成本次训练。");
await post(student, { action: "disconnect", linkId: link.id });
await detail(coach, assignment.id, [403, 404]);
await post(student, acceptedBody, [403, 404, 409]);
assert.equal((await home(coach)).assignments.find((row) => row.id === assignment.id)?.progress ?? null, null);
const own = await call(student, "/api/workout");
assert.equal(own.entries.filter((row) => row.kind === "plan").length, 1);
assert.equal(own.entries.filter((row) => row.kind === "log").length, 1);
console.log("PASS: built Worker HTTP; invite/consent/source-version/send/retry/accept/progress/privacy/feedback/disconnect; local synthetic accounts only.");

if (process.argv.includes("--fixture")) {
  const local = { id: "local_seedy", name: "Seedy" };
  const learner = actor("本地演示学员");
  const teacher = actor("本地演示教练");
  const studentLink = await connect(local, learner);
  const outgoing = await send(local, studentLink, await sourceFor(local, "演示学员 · 上肢力量"));
  await accept(learner, outgoing);
  await complete(learner, outgoing);
  await post(learner, { action: "feedback", assignmentId: outgoing.id, note: "合成演示：完成训练，最后一组感觉合适。" });
  const coachLink = await connect(teacher, local);
  await send(teacher, coachLink, await sourceFor(teacher, "教练下发 · 全身基础"));
  console.log("Prepared local_seedy browser fixture: one learner with completed assigned training, one coach with a pending plan. No invitation code was logged.");
}
