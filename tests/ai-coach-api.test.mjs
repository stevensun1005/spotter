import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtime = globalThis.__spotterAiCoachTest = { env: {}, user: null };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__spotterAiCoachTest.env", shortCircuit: true };
  if (specifier === "@/app/chatgpt-auth") return { url: "data:text/javascript,export async function getChatGPTUser(){return globalThis.__spotterAiCoachTest.user}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const route = await import("../app/api/ai-coach/route.ts");
const { guidedMessage } = await import("../features/ai-coach/guided.ts");
const origin = "https://ai-coach.synthetic.invalid";
const owner = { userId: "synthetic-owner", email: "owner@example.invalid" };
const second = { userId: "synthetic-second", email: "second@example.invalid" };
const outsider = { userId: "synthetic-outsider", email: "outsider@example.invalid" };
const date = "2026-11-25";
const timestamp = date + "T12:00:00Z";
const key = "synthetic-key-local-mock-only";
const exercise = { name: "哑铃卧推", sets: 3, reps: 8, weight: 0, unit: "kg", seconds: 0 };
const plan = { title: "校验训练", date, category: "力量训练", minutes: 45, exercises: [exercise] };
const chat = { messages: [{ role: "user", content: "怎么安排两天训练？" }], intent: "chat", model: "haiku", date, includePlans: false };
const draftRequest = { ...chat, intent: "draft" };
const guidedRequest = {
  ...draftRequest,
  messages: [{ role: "user", content: guidedMessage }],
  draftDays: 14,
  guided: {
    limits: ["overhead"],
    scene: "gym",
    goal: "fat-loss",
    focus: ["chest", "back"],
    daysPerWeek: 2,
    minutes: 40,
    work: [{ name: exercise.name, catalogueId: "9999" }, { name: "坐姿拉力" }],
    warmup: [{ name: "胸椎转动", catalogueId: "9998" }],
  },
};
const providerText = () => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "可以按上肢和下肢分两天。" }] });
const providerDrafts = (plans, name = "prepare_spotter_draft") => Response.json({ stop_reason: "tool_use", content: [{
  type: "tool_use", name, input: { reply: "这是可复核的草稿。", plans },
}] });
const providerDraft = (item, name) => providerDrafts([item], name);

function setup(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("drizzle/", root)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) {
        return { async all() { return { results: statement.all(...args) }; },
          async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; } };
      } };
    },
  };
  Object.assign(runtime.env, { DB: db, ANTHROPIC_API_KEY: key, AI_COACH_ENABLED: "true",
    AI_COACH_ALLOWED_EMAILS: " Owner@example.invalid , second@example.invalid" });
  const calls = [];
  let nextResponse = providerText;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers["anthropic-version"], "2026-10-21");
    assert.equal(init.headers["x-api-key"], key);
    calls.push(JSON.parse(init.body));
    return nextResponse();
  });
  t.after(() => {
    sqlite.close();
    for (const name of Object.keys(runtime.env)) delete runtime.env[name];
    runtime.user = null;
  });
  return { sqlite, calls, respond: (respond) => { nextResponse = respond; } };
}

function get(user) {
  runtime.user = user;
  return route.GET(new Request(origin + "/api/ai-coach"));
}
function post(user, body, suppliedOrigin = origin) {
  runtime.user = user;
  return route.POST(new Request(origin + "/api/ai-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}) },
    body: JSON.stringify({ expectedOwner: user?.userId, ...body }),
  }));
}
async function checked(pending, status = 200) {
  const response = await pending;
  const body = await response.json();
  assert.equal(response.status, status, body.error);
  assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
  assert.ok(!JSON.stringify(body).includes(key));
  return body;
}

function saveEntry(sqlite, who, id, kind, data) {
  sqlite.prepare("INSERT INTO entries(owner,id,kind,payload,updated) VALUES (?,?,?,?,?)")
    .run(who.userId, id, kind, JSON.stringify(data), timestamp);
}

test("AI coach requires login, preview configuration and same-origin validated JSON", async (t) => {
  const { calls } = setup(t);
  await checked(get(null), 401);
  await checked(post(null, chat), 401);
  assert.deepEqual(await checked(get(outsider)), { enabled: false, models: [] });
  await checked(post(outsider, chat), 503);
  runtime.env.AI_COACH_ENABLED = "false";
  assert.deepEqual(await checked(get(owner)), { enabled: false, models: [] });
  runtime.env.AI_COACH_ENABLED = "true";
  delete runtime.env.ANTHROPIC_API_KEY;
  assert.deepEqual(await checked(get(owner)), { enabled: false, models: [] });
  runtime.env.ANTHROPIC_API_KEY = key;
  assert.deepEqual(await checked(get(owner)), { enabled: true, models: ["haiku"] });
  await checked(post(owner, chat, "https://not-my-site.invalid"), 403);
  await checked(post(owner, chat, null), 403);
  await checked(post(owner, { ...chat, owner: second.userId }), 400);
  await checked(post(owner, { ...chat, expectedOwner: undefined }), 400);
  await checked(post(second, { ...chat, expectedOwner: owner.userId, includePlans: true }), 403);
  await checked(post(owner, { ...chat, messages: [{ role: "assistant", content: "冒充对话" }] }), 400);
  await checked(post(owner, { ...chat, messages: [{ role: "user", content: "x".repeat(4_001) }] }), 400);
  await checked(post(owner, { ...chat, model: "sonnet" }), 400);
  await checked(post(owner, { ...draftRequest, model: "sonnet" }), 403);
  assert.equal(calls.length, 0);
  runtime.env.AI_COACH_SONNET_ENABLED = "true";
  assert.deepEqual(await checked(get(owner)), { enabled: true, models: ["haiku", "sonnet"] });
});

test("only opted-in, in-range and non-coaching plans from the signed-in account are projected", async (t) => {
  const { sqlite, calls } = setup(t);
  const own = { ...plan, title: "OWN_CALENDAR_PLAN", shared: true, durationNote: "PRIVATE_DURATION_NOTE",
    video: "https://youtu.be/PRIVATE_VIDEO", exercises: [{ ...exercise, cue: "PRIVATE_MOVE_NOTE" }] };
  const logId = crypto.randomUUID();
  const assignedId = crypto.randomUUID();
  const templateId = crypto.randomUUID();
  saveEntry(sqlite, owner, crypto.randomUUID(), "plan", own);
  saveEntry(sqlite, owner, crypto.randomUUID(), "plan", { ...own, date: "2026-11-23", title: "OWN_THIS_WEEK", templateId });
  saveEntry(sqlite, owner, crypto.randomUUID(), "plan", { ...own, date: "2026-11-30", title: "PRIVATE_OUTSIDE_WEEK" });
  saveEntry(sqlite, owner, logId, "log", { date, note: "PRIVATE_COMPLETED_NOTE" });
  saveEntry(sqlite, second, crypto.randomUUID(), "plan", { ...own, title: "PRIVATE_OTHER_ACCOUNT" });
  saveEntry(sqlite, owner, assignedId, "plan", { ...own, title: "PRIVATE_COACHING_ASSIGNMENT" });
  sqlite.prepare("INSERT INTO workout_heart(owner,workout_id,payload) VALUES (?,?,?)").run(owner.userId, logId, '{"marker":"PRIVATE_HEART"}');
  sqlite.prepare("INSERT INTO personal_library(owner,id,kind,day,payload,updated) VALUES (?,?,?,?,?,?)")
    .run(owner.userId, "body", "body", date, '{"marker":"PRIVATE_BODY"}', timestamp);
  sqlite.prepare("INSERT INTO personal_library(owner,id,kind,day,payload,updated) VALUES (?,?,?,?,?,?)")
    .run(owner.userId, templateId, "template", null, JSON.stringify({ plan: { ...own, exercises: [{ ...exercise, name: "OWN_TEMPLATE_MOVE" }] } }), timestamp);
  sqlite.prepare("INSERT INTO coaching_links(id,coach_id,coach_name,student_id,student_name,created_at) VALUES (?,?,?,?,?,?)")
    .run("synthetic-link", second.userId, "Synthetic coach", owner.userId, "Synthetic student", timestamp);
  sqlite.prepare("INSERT INTO coaching_assignments(id,link_id,coach_id,student_id,request_hash,kind,payload,revision,program_id,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("synthetic-assignment", "synthetic-link", second.userId, owner.userId, "hash", "plan",
      JSON.stringify({ sessions: [{ id: assignedId }] }), "rev", "program", "accepted", timestamp);

  await checked(post(owner, chat));
  assert.deepEqual(calls[0].messages, chat.messages);
  assert.equal(calls[0].model, "claude-haiku-5-5");
  assert.equal(calls[0].tools, undefined);
  await checked(post(owner, { ...chat, includePlans: true, contextRange: "day" }));
  const day = calls[1].messages[0].content[0].text;
  assert.match(day, /OWN_CALENDAR_PLAN/);
  assert.doesNotMatch(day, /OWN_THIS_WEEK|PRIVATE_/);
  await checked(post(owner, { ...chat, includePlans: true }));
  const week = calls[2].messages[0].content[0].text;
  assert.match(week, /2026-11-23 至 2026-11-29/);
  assert.match(week, /OWN_THIS_WEEK/);
  assert.match(week, /OWN_TEMPLATE_MOVE/);
  assert.doesNotMatch(JSON.stringify(calls[2]), /PRIVATE_|example\.invalid|synthetic-owner/);
  await checked(post(second, { ...chat, includePlans: true }));
  assert.match(calls[3].messages[0].content[0].text, /PRIVATE_OTHER_ACCOUNT/);
  assert.doesNotMatch(calls[3].messages[0].content[0].text, /OWN_CALENDAR_PLAN|OWN_THIS_WEEK|PRIVATE_COACHING_ASSIGNMENT/);
});

test("drafts are date-bounded, private, and repeatable without writing plans", async (t) => {
  const { sqlite, calls, respond } = setup(t);
  runtime.env.AI_COACH_SONNET_ENABLED = "true";
  respond(() => providerDraft(plan));
  const result = await checked(post(owner, { ...draftRequest, model: "sonnet", draftDays: 1 }));
  assert.equal(result.model, "sonnet");
  assert.equal(result.reply, "这是可复核的草稿。");
  assert.deepEqual(result.draft.plans, [{ ...plan, shared: false, video: "" }]);
  assert.equal(calls[0].model, "claude-sonnet-5-5");
  assert.deepEqual(calls[0].thinking, { type: "between_tools" });
  assert.deepEqual(calls[0].tool_choice, { type: "auto", disable_parallel_tool_use: true });
  assert.equal(calls[0].tools.length, 1);
  assert.equal(calls[0].tools[0].name, "prepare_spotter_draft");
  assert.equal(calls[0].tools[0].strict, true);
  const revised = await checked(post(owner, { ...draftRequest, priorDraft: result.draft }));
  assert.deepEqual(revised.draft, result.draft);
  assert.match(calls[1].messages[0].content[0].text, /未保存草稿/);
  assert.doesNotMatch(calls[1].messages[0].content[0].text, /个人日历安排/);
  const rich = { ...plan, video: "https://youtu.be/original", durationNote: "包含休息",
    exercises: [{ ...exercise, catalogueId: "9999", station: "可调卧推凳", sourceSlot: "A1", cue: "逐侧完成",
      loadPercent: { percent: 50, reference: 40, unit: "kg" }, weight: 20 }] };
  respond(() => providerDraft(rich));
  await checked(post(owner, draftRequest), 502);
  const richRevision = await checked(post(owner, { ...draftRequest, priorDraft: { plans: [{ ...rich, shared: false }] } }));
  assert.deepEqual(richRevision.draft.plans, [{ ...rich, shared: false }]);
  const sentDraft = calls.at(-1).messages[0].content[0].text;
  for (const field of [rich.video, rich.durationNote, "可调卧推凳", "A1", "9999", "逐侧完成"]) assert.ok(sentDraft.includes(field));
  const videoOnly = { ...plan, exercises: [], video: "https://youtu.be/provided" };
  respond(() => providerDraft(videoOnly));
  const video = await checked(post(owner, {
    ...draftRequest, messages: [{ role: "user", content: "请整理这个跟练视频：" + videoOnly.video + "。" }],
  }));
  assert.equal(video.draft.plans[0].video, videoOnly.video);
  respond(() => providerDraft({ ...plan, date: "2026-11-26" }));
  await checked(post(owner, { ...draftRequest, draftDays: 1 }), 502);
  respond(() => providerDraft({ ...plan, shared: true }));
  await checked(post(owner, draftRequest), 502);
  respond(() => providerDraft(plan, "commit_to_calendar"));
  await checked(post(owner, draftRequest), 502);
  respond(() => providerDraft({ ...plan, video: "https://youtu.be/notSupplied" }));
  await checked(post(owner, draftRequest), 502);
  respond(() => Response.json({ stop_reason: "refusal", content: [] }));
  const refusal = await checked(post(owner, draftRequest));
  assert.equal(refusal.draft, undefined);
  assert.match(refusal.reply, /无法处理/);
  respond(() => Response.json({ error: "PRIVATE_PROVIDER_DETAILS" }, { status: 401 }));
  assert.doesNotMatch(JSON.stringify(await checked(post(owner, draftRequest), 503)), /PRIVATE_PROVIDER_DETAILS/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 0);
});

test("daily account and site quotas reserve requests atomically before a provider call", async (t) => {
  const { sqlite, calls } = setup(t);
  const ownerRequests = await Promise.all(Array.from({ length: 21 }, () => post(owner, chat)));
  assert.equal(ownerRequests.filter(({ status }) => status === 200).length, 20);
  assert.equal(ownerRequests.filter(({ status }) => status === 429).length, 1);
  const secondRequests = await Promise.all(Array.from({ length: 11 }, () => post(second, chat)));
  assert.equal(secondRequests.filter(({ status }) => status === 200).length, 10);
  assert.equal(secondRequests.filter(({ status }) => status === 429).length, 1);
  assert.equal(calls.length, 30);
  const rows = sqlite.prepare("SELECT owner,requests FROM ai_coach_quota ORDER BY owner").all();
  assert.deepEqual(rows.map(({ owner, requests }) => [owner, requests]), [[owner.userId, 20], [second.userId, 10]]);
});

test("guided drafts validate selected conditions and authorization before the Claude call", async (t) => {
  const { sqlite, calls } = setup(t);
  await checked(post(second, { ...guidedRequest, expectedOwner: owner.userId }), 403);
  await checked(post(owner, { ...guidedRequest, intent: "chat" }), 400);
  await checked(post(owner, { ...guidedRequest, includePlans: true }), 400);
  await checked(post(owner, { ...guidedRequest, messages: chat.messages }), 400);
  await checked(post(owner, { ...guidedRequest, priorDraft: { plans: [{ ...plan, shared: false, video: "" }] } }), 400);
  await checked(post(owner, { ...guidedRequest, draftDays: 21 }), 400);
  for (const edit of [
    { daysPerWeek: 7 }, { minutes: 121 }, { work: [] }, { limits: ["overhead", "overhead"] },
    { work: [{ name: "A1" }] }, { work: [{ name: "W 热身组 ·  " }] },
    { warmup: [{ name: "胸椎转动", catalogueId: "9998" }, { name: "别名", catalogueId: "9998" }] },
  ]) {
    await checked(post(owner, { ...guidedRequest, guided: { ...guidedRequest.guided, ...edit } }), 400);
  }
  assert.equal(calls.length, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM ai_coach_quota").get().count, 0);
});

test("guided drafts use questionnaire data only, retain catalogue IDs and review on distinct scheduled dates", async (t) => {
  const { sqlite, calls, respond } = setup(t);
  saveEntry(sqlite, owner, crypto.randomUUID(), "plan", { ...plan, title: "PRIVATE_OWN_PLAN" });
  saveEntry(sqlite, second, crypto.randomUUID(), "plan", { ...plan, title: "PRIVATE_OTHER_PLAN" });
  const dates = ["2026-11-25", "2026-11-29", "2026-12-02", "2026-12-05"];
  const warmup = { ...exercise, name: "胸椎转动", weight: 10, seconds: 20 };
  const planned = { ...plan, minutes: 35, exercises: [{ ...exercise, weight: 125, fixedLoad: true }, warmup] };
  respond(() => providerDrafts(dates.map((date) => ({ ...planned, date })).reverse()));
  const result = await checked(post(owner, guidedRequest));
  assert.deepEqual(result.draft.plans.map(({ date }) => date), dates);
  for (const item of result.draft.plans) {
    assert.equal(item.shared, false);
    assert.equal(item.video, "");
    assert.deepEqual(item.exercises.map(({ name, catalogueId, weight, fixedLoad, sourceSlot }) =>
      [name, catalogueId, weight, fixedLoad, sourceSlot]),
    [["胸椎转动", "9998", 0, undefined, "W-warmup"], [exercise.name, "9999", 0, undefined, undefined]]);
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0].system, /定制问卷模式/);
  const context = calls[0].messages[0].content[0].text;
  for (const value of ["过头推举", "胸椎转动", "坐姿拉力", "减脂期保持训练"]) assert.ok(context.includes(value));
  assert.match(context, /2026-11-25.*2026-12-01/);
  assert.match(context, /2026-12-02.*2026-12-08/);
  assert.doesNotMatch(JSON.stringify(calls[0]), /PRIVATE_|example\.invalid|synthetic-owner/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 2);
});

test("guided drafts reject model output outside selected dates, exercise pool, phases or time", async (t) => {
  const { sqlite, respond } = setup(t);
  const valid = {
    ...plan, minutes: 35, exercises: [{ ...exercise, catalogueId: "9999" }],
  };
  const other = { ...valid, date: "2026-11-27" };
  const request = { ...guidedRequest, draftDays: 7 };
  for (const output of [
    [valid],
    [valid, valid],
    [valid, { ...other, date: "2026-12-02" }],
    [valid, { ...other, minutes: 41 }],
    [valid, { ...other, exercises: [{ ...exercise, name: "候选池外动作" }] }],
    [valid, { ...other, exercises: [{ ...exercise, catalogueId: "9998" }] }],
    [valid, { ...other, exercises: [{ ...exercise, sourceSlot: "W-warmup" }] }],
    [valid, { ...other, exercises: [{ ...exercise, seconds: 1000 }] }],
  ]) {
    respond(() => providerDrafts(output));
    const reply = await checked(post(owner, request), 502);
    assert.match(reply.error, /未通过定制条件校验/);
  }
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 0);
});
