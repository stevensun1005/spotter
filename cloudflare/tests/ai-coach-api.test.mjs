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
const photoRoute = await import("../app/api/food-photo/route.ts");
const { guidedMessage } = await import("../features/ai-coach/guided.ts");
const origin = "https://ai-coach.synthetic.invalid";
const owner = { userId: "synthetic-owner", email: "owner@example.invalid" };
const second = { userId: "synthetic-second", email: "second@example.invalid" };
const outsider = { userId: "synthetic-outsider", email: "outsider@example.invalid" };
const date = "2026-11-25";
const timestamp = date + "T12:00:00Z";
const blankQuota = { dailyLimit: 200, monthlyLimit: 2000, dailyRemaining: 200, monthlyRemaining: 2000,
  dailyResetsAt: "2026-11-26T00:00:00.000Z", monthlyResetsAt: "2026-12-01T00:00:00.000Z" };
const monthlyCap = 10_000_000_000;
const usage = { input_tokens: 300, output_tokens: 40, inference_geo: "global", service_tier: "standard" };
const knownCost = 50_000;
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
const providerMessage = (body) => Response.json({ usage, ...body });
const providerText = () => providerMessage({ stop_reason: "end_turn", content: [{ type: "text", text: "可以按上肢和下肢分两天。" }] });
const providerDrafts = (plans, name = "prepare_spotter_draft") => providerMessage({ stop_reason: "tool_use", content: [{
  type: "tool_use", name, input: { reply: "这是可复核的草稿。", plans },
}] });
const providerDraft = (item, name) => providerDrafts([item], name);

function setup(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(timestamp) });
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("drizzle/", root)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) {
        const execute = () => statement.columns().length ? { results: statement.all(...args), meta: { changes: 0 } }
          : { results: [], meta: { changes: Number(statement.run(...args).changes) } };
        return { execute, async first() { return statement.get(...args) ?? null; },
          async all() { return execute(); }, async run() { return execute(); } };
      } };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  Object.assign(runtime.env, { DB: db, ANTHROPIC_API_KEY: key, AI_COACH_ENABLED: "true" });
  const calls = [];
  let nextResponse = providerText;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.redirect, "manual");
    assert.equal(init.cache, undefined);
    assert.equal(init.headers["anthropic-version"], "2026-10-21");
    assert.equal(init.headers["x-api-key"], key);
    const body = JSON.parse(init.body);
    assert.equal(body.model, "claude-haiku-5-5");
    assert.deepEqual(body.output_config, { effort: "medium" });
    assert.equal(body.inference_geo, "global");
    assert.equal(body.service_tier, "standard_only");
    calls.push(body);
    return nextResponse();
  });
  t.after(() => {
    sqlite.close();
    for (const name of Object.keys(runtime.env)) delete runtime.env[name];
    runtime.user = null;
  });
  const charged = (account, month = date.slice(0, 7)) => sqlite.prepare(
    "SELECT charged_nanos FROM ai_coach_budget WHERE month = ? AND owner = ?",
  ).get(month, account.userId)?.charged_nanos ?? 0;
  const seedMessages = (account, day, count) => sqlite.prepare(
    "INSERT INTO ai_coach_quota (day, owner, requests) VALUES (?, ?, ?)",
  ).run(Date.parse(day) / 86_400_000, account.userId, count);
  return { sqlite, calls, charged, seedMessages, respond: (respond) => { nextResponse = respond; } };
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

const photo = { mode: "meal", image: { mediaType: "image/jpeg", base64: "/9j/AAAAAAAAAAAA" }, notes: "一碗午饭" };
function photoPost(user, body, suppliedOrigin = origin) {
  runtime.user = user;
  return photoRoute.POST(new Request(origin + "/api/food-photo", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: suppliedOrigin },
    body: JSON.stringify({ expectedOwner: user?.userId, ...body }),
  }));
}
const photoTool = (name, input) => () => providerMessage({ stop_reason: "tool_use", content: [{ type: "tool_use", name, input }] });

test("text meal logging estimates the confirmed meal in the same conversation", async (t) => {
  const { calls, respond, sqlite } = setup(t);
  const localDate = "2026-11-26";
  const food = "我中午现在吃了十个汤圆和两个蛋挞";
  const command = "帮我加进饮食里";
  const ask = "这顿还有别的食物吗？";
  const messages = [{ role: "user", content: food }, { role: "assistant", content: "你想记录这顿吗？" },
    { role: "user", content: command }];
  const draft = { name: "汤圆 × 10、蛋挞 × 2", grams: 420, calories: 733, protein: 15, carbs: 101, fat: 30 };
  const estimate = "汤圆按普通大小、每个约 30 克，蛋挞每个约 60 克。";
  respond(photoTool("prepare_meal_log", { meal: "午餐", ...draft, estimate }));
  const prepared = await checked(post(owner, { ...chat, messages, includePlans: true, mealLogging: { date: localDate } }));
  assert.deepEqual(prepared.mealAction, { kind: "ready", meal: "午餐", date: localDate, draft, estimate });
  assert.equal(prepared.quota.dailyRemaining, 199);
  assert.equal(calls[0].tools[0].name, "prepare_meal_log");
  assert.match(calls[0].system, /不要声称已写入饮食/u);
  assert.ok(calls[0].messages[0].content.endsWith(JSON.stringify(messages)));

  respond(photoTool("ask_meal_log_details", { question: ask }));
  assert.deepEqual((await checked(post(owner, { ...chat, messages, mealLogging: { date: localDate } }))).mealAction,
    { kind: "needs", question: ask });
  respond(photoTool("prepare_meal_log", { meal: "午餐", ...draft, estimate }));
  const continued = [...messages, { role: "assistant", content: ask }, { role: "user", content: "就这些" }];
  const meal = await checked(post(owner, { ...chat, messages: continued, mealLogging: { pending: true, date: localDate } }));
  assert.deepEqual(meal.mealAction, prepared.mealAction);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM personal_library").get().count, 0);
});

test("a completed meal report prepares an automatic record on the first turn", async (t) => {
  const { calls, respond, sqlite } = setup(t);
  const localDate = "2026-11-26";
  const messages = [{ role: "user", content: "吃了一个蛋挞作加餐" }];
  const draft = { name: "蛋挞 × 1", grams: 55, calories: 190, protein: 4, carbs: 19, fat: 11 };
  const estimate = "按一个普通大小的蛋挞约 55 克估算。";
  respond(photoTool("prepare_meal_log", { meal: "加餐", ...draft, estimate }));

  const first = await checked(post(owner, { ...chat, messages, mealLogging: { date: localDate } }));
  assert.deepEqual(first.mealAction, { kind: "ready", meal: "加餐", date: localDate, draft, estimate });
  assert.ok(calls[0].messages[0].content.endsWith(JSON.stringify(messages)));
  assert.equal(first.quota.dailyRemaining, 199);

  const saved = [...messages, { role: "assistant", content: "已把刚才这餐记入饮食日记。" },
    { role: "user", content: "帮我添加进去" }];
  const followUp = await checked(post(owner, { ...chat, messages: saved, mealLogging: { date: localDate, historyStart: 2 } }));
  assert.deepEqual(followUp, { reply: "刚才这餐已经记入饮食。", model: "haiku" });
  assert.equal(calls.length, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM personal_library").get().count, 0,
    "The app saves only the structured ready action and owns the receipt.");
});

test("a short request to add it uses the latest unsaved meal in context", async (t) => {
  const { calls, respond } = setup(t);
  const localDate = "2026-11-26";
  const food = { role: "user", content: "吃了一个蛋挞作加餐" };
  const command = { role: "user", content: "帮我添加进去" };
  const olderMeal = { role: "user", content: "昨天晚餐吃了一碗面" };
  const advice = { role: "assistant", content: "蛋挞作加餐没问题。" };
  const draft = { name: "蛋挞 × 1", grams: 55, calories: 190, protein: 4, carbs: 19, fat: 11 };
  respond(photoTool("prepare_meal_log", { meal: "加餐", ...draft, estimate: "按普通大小估算。" }));

  const messages = [olderMeal, advice, food, advice, command];
  const result = await checked(post(owner, { ...chat, messages, mealLogging: { date: localDate } }));
  assert.deepEqual(result.mealAction, {
    kind: "ready", date: localDate, meal: "加餐", draft, estimate: "按普通大小估算。",
  });
  assert.match(calls[0].messages[0].content, /吃了一个蛋挞作加餐/u);
  assert.doesNotMatch(calls[0].messages[0].content, /昨天晚餐吃了一碗面/u);
});

test("auto-logging leaves nutrition questions and other people's meals in chat", async (t) => {
  const { calls } = setup(t);
  const advice = { role: "assistant", content: "我们可以继续聊这顿。" };
  const command = { role: "user", content: "帮我添加进去" };
  for (const messages of [
    [{ role: "user", content: "吃了一个蛋挞作加餐，热量会不会太高？" }],
    [{ role: "user", content: "如果我吃一个蛋挞作加餐" }, advice, command],
    [{ role: "user", content: "我朋友吃了一个蛋挞作加餐" }, advice, command],
    [{ role: "user", content: "我没吃蛋挞" }],
    [{ role: "user", content: "吃了一个蛋挞作加餐，别记" }],
    [{ role: "user", content: "吃了一个蛋挞作加餐" }, advice,
      { role: "user", content: "我的训练计划还有哪几天？" }, advice, command],
  ]) {
    const response = await checked(post(owner, { ...chat, messages, mealLogging: {} }));
    assert.equal(response.mealAction, undefined, JSON.stringify(messages));
    assert.equal(calls.at(-1).tools, undefined, JSON.stringify(messages));
  }
});

test("text meal recognition requires current authorization and respects date and nutrition bounds", async (t) => {
  const { calls, respond } = setup(t);
  const command = "帮我加进饮食里";
  const ask = "这顿是哪天吃的？";
  const continuing = [{ role: "user", content: command }, { role: "assistant", content: ask }, { role: "user", content: "就这些" }];
  for (const payload of [
    { messages: continuing },
    { messages: continuing, mealLogging: { pending: true, historyStart: 2 } },
    { messages: [{ role: "user", content: "如果午餐吃两个蛋挞，帮我记一下" }], mealLogging: {} },
    { messages: [{ role: "user", content: "不要帮我加进饮食里" }], mealLogging: {} },
    { messages: [{ role: "user", content: "午餐应该吃两个蛋挞吗？" }], mealLogging: {} },
    { messages: [{ role: "user", content: "汤圆和蛋挞能不能一起吃？" }], mealLogging: { pending: true } },
    { messages: [{ role: "user", content: "你觉得这顿怎么样？" }, { role: "assistant", content: command },
      { role: "user", content: "就这些" }], mealLogging: { pending: true } },
  ]) {
    const response = await checked(post(owner, { ...chat, ...payload }));
    assert.equal(response.mealAction, undefined);
    assert.equal(calls.at(-1).tools, undefined);
  }
  const cancelled = await checked(post(owner, { ...chat, messages: [...continuing.slice(0, 2), { role: "user", content: "取消刚才的记餐" }], mealLogging: { pending: true } }));
  assert.deepEqual(cancelled.mealAction, { kind: "cancelled" });
  assert.equal(calls.length, 7);
  await checked(post(owner, { ...chat, mealLogging: { historyStart: 1 } }), 400);
  await checked(post(second, { ...chat, mealLogging: {}, expectedOwner: owner.userId }), 403);
  assert.equal(calls.length, 7);

  const ready = { meal: "晚餐", name: "汤圆和蛋挞", grams: 420, calories: 733, protein: 15, carbs: 101, fat: 30 };
  const input = { ...chat, messages: [{ role: "user", content: "帮我记昨天的晚餐，十个汤圆和两个蛋挞" }], mealLogging: { date } };
  respond(photoTool("prepare_meal_log", { ...ready, grams: 1 }));
  await checked(post(owner, input), 502);
  respond(photoTool("prepare_meal_log", ready));
  assert.equal((await checked(post(owner, input))).mealAction.date, "2026-11-24");
  const future = await checked(post(owner, { ...input, messages: [{ role: "user", content: "帮我记录明天的晚餐，两个蛋挞" }] }));
  assert.equal(future.mealAction.kind, "needs");
  assert.equal(calls.length, 9);
});

test("in-site photo shares the monthly Claude budget with chat and returns only a draft", async (t) => {
  const { calls, charged, sqlite, respond } = setup(t);
  runtime.user = owner;
  assert.deepEqual(await checked(photoRoute.GET(new Request(origin + "/api/food-photo"))), { enabled: true, owner: owner.userId });
  const draft = { name: "米饭和煎蛋", grams: 215, calories: 346.25, protein: 14, carbs: 49, fat: 10 };
  respond(photoTool("prepare_food_photo", draft));
  assert.deepEqual(await checked(photoPost(owner, photo)), { draft });
  assert.deepEqual(calls[0].messages[0].content[0], { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo.image.base64 } });
  assert.equal(calls[0].messages.length, 1);
  assert.equal(charged(owner), knownCost);
  respond(providerText);
  await checked(post(owner, chat));
  assert.equal(charged(owner), 2 * knownCost);
  const quota = { ...blankQuota, dailyRemaining: 199, monthlyRemaining: 1999 };
  assert.deepEqual((await checked(get(owner))).quota, quota);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM personal_library").get().count, 0);
  sqlite.prepare("UPDATE ai_coach_budget SET charged_nanos = ? WHERE owner = ?").run(monthlyCap, owner.userId);
  assert.match((await checked(post(owner, chat), 429)).error, /本月 AI 额度不足/);
  assert.match((await checked(post(owner, draftRequest), 429)).error, /本月 AI 额度不足/);
  assert.match((await checked(photoPost(owner, photo), 429)).error, /本月 AI 额度不足/);
  assert.match((await checked(photoPost(owner, { ...photo, inCoach: true }), 429)).error, /本月 AI 额度不足/);
  assert.deepEqual((await checked(get(owner))).quota, quota, "A failed spend reservation should not consume a message");
  assert.equal(calls.length, 2);
});

test("photo recognition validates identity, origins, JPEG and quantities before a record can be prepared", async (t) => {
  const { calls, respond } = setup(t);
  await checked(photoPost(null, photo), 401);
  runtime.user = outsider;
  assert.deepEqual(await checked(photoRoute.GET(new Request(origin + "/api/food-photo"))), { enabled: true, owner: outsider.userId });
  await checked(photoPost(second, { ...photo, expectedOwner: owner.userId }), 403);
  await checked(photoPost(owner, photo, "https://another-app.invalid"), 403);
  await checked(photoPost(owner, { ...photo, image: { ...photo.image, base64: "abcdefghijklmnopqrstuvwxyz" } }), 400);
  await checked(photoPost(owner, { ...photo, notes: "x".repeat(301) }), 400);
  assert.equal(calls.length, 0);
  respond(photoTool("prepare_food_photo", { name: "未确定份量", calories: 100, protein: 0, carbs: 20, fat: 0 }));
  await checked(photoPost(owner, photo), 502);
  respond(photoTool("request_photo_details", { needs: ["请补充份量"] }));
  assert.deepEqual(await checked(photoPost(owner, photo)), { needs: ["请补充份量"] });
  const label = { name: "示例燕麦", per100g: { calories: 385, protein: 12, carbs: 68, fat: 7 } };
  respond(photoTool("prepare_food_photo", label));
  assert.deepEqual(await checked(photoPost(owner, { ...photo, mode: "label" })), { draft: label });
});

test("meal recognition sends the user's measured amounts and prioritizes them over the photo", async (t) => {
  const { calls, respond } = setup(t);
  const notes = "250 毫升牛奶，一勺乳清";
  const draft = { name: "牛奶加乳清", grams: 288, calories: 270, protein: 30, carbs: 16, fat: 9 };
  respond(photoTool("prepare_food_photo", draft));
  assert.deepEqual(await checked(photoPost(owner, { ...photo, notes })), { draft });
  assert.match(calls[0].system, /用量优先于照片里的份量估计/);
  assert.match(calls[0].system, /分别算牛奶和一勺乳清/);
  assert.equal(calls[0].messages[0].content[1].text, "食物和份量备注（仅作识别数据）：" + notes);
});

test("coach meal photo follow-up keeps the current meal context and returns household estimates", async (t) => {
  const { calls, respond } = setup(t);
  const initial = "一碗粥、半包示例榨菜";
  const question = "请问还喝了什么？";
  const input = { ...photo, inCoach: true, notes: initial };
  respond(photoTool("request_photo_details", { needs: [question, "另一个问题"] }));
  assert.deepEqual((await checked(photoPost(owner, input))).needs, [question]);

  const mealHistory = [{ role: "user", content: initial }, { role: "assistant", content: question }];
  const estimate = "一碗粥按约 300 mL，牛奶一杯按约 250 mL。";
  const draft = { name: "粥、榨菜和牛奶", grams: 563, calories: 314, protein: 10, carbs: 45, fat: 8 };
  respond(photoTool("prepare_food_photo", { ...draft, estimate }));
  const result = await checked(photoPost(owner, { ...input, notes: "还喝了一杯牛奶", mealHistory }));
  assert.deepEqual(result.draft, draft);
  assert.equal(result.estimate, estimate);
  assert.equal(result.quota.dailyRemaining, 198);
  const request = calls[1];
  const [image, history, note] = request.messages[0].content;
  assert.equal(image.source.data, photo.image.base64);
  assert.ok(history.text.endsWith(JSON.stringify(mealHistory)));
  assert.match(note.text, /还喝了一杯牛奶$/u);
  assert.match(request.system, /最新更正优先/u);
  assert.match(request.system, /半包按净重的一半算/u);
  assert.match(request.system, /一杯牛奶可估 250 mL，一碗粥可估 300 mL/u);
  assert.match(request.system, /无需确认克数/u);
  assert.deepEqual(request.tools[0].input_schema.properties.estimate.type, ["string", "null"]);

  await checked(photoPost(second, { ...input, mealHistory, expectedOwner: owner.userId }), 403);
  await checked(photoPost(owner, { ...photo, mealHistory }), 400);
  await checked(photoPost(owner, { image: photo.image, mode: "protein", inCoach: true, mealHistory }), 400);
  await checked(photoPost(owner, { ...input, mealHistory: Array(7).fill(mealHistory[0]) }), 400);
  await checked(photoPost(owner, { ...input, mealHistory: [{ role: "user", content: "x".repeat(301) }] }), 400);
  assert.equal(calls.length, 2);
});

test("protein photos independently return the name on the front and legible nutrition on the back", async (t) => {
  const { calls, respond, sqlite } = setup(t);
  const request = { mode: "protein", image: photo.image };
  await checked(photoPost(second, { ...request, expectedOwner: owner.userId }), 403);
  await checked(photoPost(owner, { ...request, notes: "600 mL 2% 牛奶，昨天和今天各一杯" }), 400);
  assert.equal(calls.length, 0);

  respond(photoTool("prepare_protein_photo", { name: "示例乳清 草莓味", scoopGrams: null, per100g: null }));
  assert.deepEqual(await checked(photoPost(owner, request)), { product: { name: "示例乳清 草莓味" } });
  assert.equal(calls[0].tools[0].name, "prepare_protein_photo");
  assert.match(calls[0].system, /不能当作一勺重量/);
  assert.match(calls[0].system, /用量、饮料、喝了几次或记录日期不属于包装识别范围/);
  assert.equal(calls[0].messages[0].content[1].text, "请读取蛋白粉包装中可见的标签信息。");

  const per100g = { calories: 380, protein: 80, carbs: 5, fat: 4 };
  respond(photoTool("prepare_protein_photo", { name: null, scoopGrams: 30, per100g }));
  assert.deepEqual(await checked(photoPost(owner, request)), { product: { scoopGrams: 30, per100g } });

  respond(photoTool("prepare_protein_photo", { name: "示例乳清 草莓味", scoopGrams: 1000,
    per100g: { calories: 380, protein: 80, carbs: 50, fat: 4 } }));
  assert.deepEqual(await checked(photoPost(owner, request)), { product: { name: "示例乳清 草莓味" } });

  respond(photoTool("request_photo_details", { needs: ["请确认牛奶量"] }));
  const need = await checked(photoPost(owner, request));
  assert.deepEqual(need, { needs: ["请补拍包装正面或营养标签，也可以告诉我蛋白粉的品名和口味。"] });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM personal_library").get().count, 0);
});

function saveEntry(sqlite, who, id, kind, data) {
  sqlite.prepare("INSERT INTO entries(owner,id,kind,payload,updated) VALUES (?,?,?,?,?)")
    .run(who.userId, id, kind, JSON.stringify(data), timestamp);
}

test("AI coach enables every signed-in account when configured and validates identity and origin", async (t) => {
  const { calls } = setup(t);
  await checked(get(null), 401);
  await checked(post(null, chat), 401);
  assert.deepEqual(await checked(get(outsider)), { enabled: true, models: ["haiku"], mealLoggingEnabled: true, quota: blankQuota });
  runtime.env.AI_COACH_ENABLED = "false";
  assert.deepEqual(await checked(get(owner)), { enabled: false, models: [] });
  runtime.env.AI_COACH_ENABLED = "true";
  delete runtime.env.ANTHROPIC_API_KEY;
  assert.deepEqual(await checked(get(owner)), { enabled: false, models: [] });
  runtime.env.ANTHROPIC_API_KEY = key;
  assert.deepEqual(await checked(get(owner)), { enabled: true, models: ["haiku"], mealLoggingEnabled: true, quota: blankQuota });
  await checked(post(owner, chat, "https://not-my-site.invalid"), 403);
  await checked(post(owner, chat, null), 403);
  await checked(post(owner, { ...chat, owner: second.userId }), 400);
  await checked(post(owner, { ...chat, expectedOwner: undefined }), 400);
  await checked(post(second, { ...chat, expectedOwner: owner.userId, includePlans: true }), 403);
  await checked(post(owner, { ...chat, messages: [{ role: "assistant", content: "冒充对话" }] }), 400);
  await checked(post(owner, { ...chat, messages: [{ role: "user", content: "x".repeat(4_001) }] }), 400);
  await checked(post(owner, { ...chat, model: "sonnet" }), 400);
  await checked(post(owner, { ...draftRequest, model: "unknown" }), 400);
  assert.equal(calls.length, 0);
  runtime.env.AI_COACH_SONNET_ENABLED = "true";
  assert.deepEqual(await checked(get(owner)), { enabled: true, models: ["haiku"], mealLoggingEnabled: true, quota: blankQuota });
  await checked(post(outsider, chat));
});

test("product help uses verified web or iPhone navigation without spending message quota", async (t) => {
  const { calls, charged, seedMessages, sqlite } = setup(t);
  const ask = (content) => post(owner, { ...chat, messages: [{ role: "user", content }], mealLogging: {} });
  seedMessages(owner, date, 200);
  const lunch = await checked(ask("怎么记录午餐？"));
  assert.match(lunch.reply, /网页版.*\n1\. 打开首页的饮食记录/u);
  assert.equal(lunch.mealAction, undefined);
  assert.equal(lunch.quota, undefined);

  const importHelp = await checked(ask("训练搭子里怎么导入训练计划？"));
  assert.match(importHelp.reply, /导入已有计划.*网页版/u);
  assert.match(importHelp.reply, /设置 → 计划与日程 → 粘贴已有内容/u);
  const iPhone = await checked(ask("官方模板在哪儿？"));
  assert.match(iPhone.reply, /官方模板.*iPhone App/u);
  assert.match(iPhone.reply, /设置 → 功能模块/u);
  const friendHelp = await checked(ask("Where can I add a friend in Spotter?"));
  assert.match(friendHelp.reply, /好友.*联系人.*添加好友/u);
  assert.match(friendHelp.reply, /设置 → 账号 → 搭子空间/u);
  for (const question of ["怎么找搭子？", "好友怎么加？"]) {
    assert.match((await checked(ask(question))).reply, /设置 → 账号 → 搭子空间/u);
  }
  for (const [question, answer] of [
    ["怎么复制提示词？", /MCP、OpenAPI/u],
    ["怎么删除个人模板？", /确认删除/u],
    ["怎么改个人模板的名字？", /编辑模板/u],
    ["跟练链接在哪？", /待训练/u],
    ["怎么用外部 Agent 改模板？", /核对变更预览/u],
    ["怎么上传动作 GIF？", /添加或移除个人演示动图/u],
    ["怎么给好友加备注？", /添加备注.*仅自己可见/su],
    ["怎么移除搭子备注？", /移除备注/u],
    ["训练中怎么开始动作倒计时？", /iPhone App.*开始计时/su],
    ["怎么切换专注训练界面？", /iPhone App.*训练偏好 → 训练界面/su],
    ["怎么删除账号？", /权限与隐私 → 删除账号/u],
    ["怎么退出登录？", /退出当前账号/u],
    ["怎么设置碳循环？", /跟随营养目标/u],
    ["营养目标在哪？", /手动填写/u],
  ]) {
    assert.match((await checked(ask(question))).reply, answer);
  }
  const unknown = await checked(ask("训练搭子里在哪里看睡眠评分？"));
  assert.match(unknown.reply, /还没找到这个功能/u);

  assert.equal((await checked(get(owner))).quota.dailyRemaining, 0);
  runtime.env.AI_COACH_ENABLED = "false";
  assert.equal((await checked(get(owner))).enabled, false);
  for (const question of ["怎么用？", "训练搭子怎么用？", "这个 App 有什么功能？"]) {
    assert.match((await checked(ask(question))).reply, /训练搭子的使用方法/u);
  }
  await checked(post(second, { ...chat, expectedOwner: owner.userId, messages: [{ role: "user", content: "官方模板在哪儿？" }] }), 403);
  await checked(post(null, { ...chat, messages: [{ role: "user", content: "官方模板在哪儿？" }] }), 401);
  assert.equal(calls.length, 0);
  assert.equal(charged(owner), 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM personal_library").get().count, 0);
});

test("product help leaves coaching and action turns on their existing paths", async (t) => {
  const { calls, respond } = setup(t);
  const ask = (content) => post(owner, { ...chat, messages: [{ role: "user", content }], mealLogging: {} });
  for (const question of ["怎么提高平均心率？", "如何增加体重？", "怎么练跑步的耐力？",
    "如何安排训练计划减脂？", "官方模板在哪里？然后帮我删除训练计划"]) {
    const response = await checked(ask(question));
    assert.match(response.reply, /分两天/u);
  }

  respond(photoTool("prepare_meal_log", { meal: "午餐", name: "蛋挞", grams: 120,
    calories: 350, protein: 6, carbs: 42, fat: 18, estimate: "两个普通大小的蛋挞。" }));
  assert.equal((await checked(ask("帮我记录午餐，吃了两个蛋挞"))).mealAction.kind, "ready");
  assert.equal((await checked(ask("官方模板在哪里？然后帮我记下刚吃的午餐"))).mealAction.kind, "ready");
  assert.equal(calls.length, 7);
  assert.equal(calls.at(-1).tools[0].name, "prepare_meal_log");
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
  respond(() => providerDraft(plan));
  const result = await checked(post(owner, { ...draftRequest, model: "sonnet", draftDays: 1 }));
  assert.equal(result.model, "haiku");
  assert.equal(result.reply, "这是可复核的草稿。");
  assert.deepEqual(result.draft.plans, [{ ...plan, shared: false, video: "" }]);
  assert.deepEqual(calls[0].thinking, { type: "disabled" });
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
  respond(() => providerMessage({ stop_reason: "refusal", content: [] }));
  const refusal = await checked(post(owner, draftRequest));
  assert.equal(refusal.draft, undefined);
  assert.match(refusal.reply, /无法处理/);
  const diagnostics = t.mock.method(console, "error", () => {});
  respond(() => Response.json({ error: {
    type: "invalid_request_error", message: "anthropic-workspace-id is required: PRIVATE_PROVIDER_DETAILS",
    details: { error_code: "PRIVATE_PROVIDER_DETAILS" },
  } }, { status: 400 }));
  assert.doesNotMatch(JSON.stringify(await checked(post(owner, draftRequest), 503)), /PRIVATE_PROVIDER_DETAILS/);
  assert.deepEqual(diagnostics.mock.calls[0].arguments, ["Spotter Anthropic request rejected", {
    status: 400, type: "invalid_request_error", code: undefined, reason: "workspace_required",
  }]);
  respond(() => { throw new TypeError("Invalid header value: PRIVATE_PROVIDER_DETAILS"); });
  assert.doesNotMatch(JSON.stringify(await checked(post(owner, chat), 503)), /PRIVATE_PROVIDER_DETAILS/);
  assert.deepEqual(diagnostics.mock.calls[1].arguments, ["Spotter Anthropic transport failure", "invalid_header"]);
  const beforeRedirect = calls.length;
  respond(() => Response.redirect("https://another-app.invalid/"));
  await checked(post(owner, chat), 503);
  assert.equal(calls.length, beforeRedirect + 1);
  assert.deepEqual(diagnostics.mock.calls[2].arguments, ["Spotter Anthropic request redirected", { status: 302 }]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 0);
});

test("monthly usage is isolated by signed-in account and resets at the UTC month boundary", async (t) => {
  const { charged, calls } = setup(t);
  for (let i = 0; i < 21; i++) await checked(post(owner, chat));
  for (let i = 0; i < 11; i++) await checked(post(second, chat));
  assert.equal(calls.length, 32);
  assert.equal(charged(owner), 21 * knownCost);
  assert.equal(charged(second), 11 * knownCost);
  t.mock.timers.setTime(Date.parse("2026-12-01T00:00:00Z"));
  await checked(post(owner, chat));
  assert.equal(charged(owner, "2026-12"), knownCost);
  assert.equal(charged(second, "2026-12"), 0);
  assert.equal(charged(owner), 21 * knownCost);
});

test("concurrent conversation requests allow the 200th message, then block until the next UTC day", async (t) => {
  const { seedMessages, calls, charged } = setup(t);
  seedMessages(owner, date, 199);
  const history = [{ role: "user", content: "之前的提问" }, { role: "assistant", content: "之前的答复" }, ...chat.messages];
  const attempts = await Promise.all([post(owner, { ...chat, messages: history }), post(owner, chat)]);
  const allowed = attempts.find((response) => response.status === 200);
  const denied = attempts.find((response) => response.status === 429);
  const quota = { ...blankQuota, dailyRemaining: 0, monthlyRemaining: 1800 };
  assert.deepEqual((await checked(allowed)).quota, quota);
  const blocked = await checked(denied, 429);
  assert.equal(blocked.code, "coach_daily_limit");
  assert.deepEqual(blocked.quota, quota);
  assert.equal(calls.length, 1);
  assert.equal(charged(owner), knownCost);
  assert.deepEqual((await checked(get(second))).quota, blankQuota);

  t.mock.timers.setTime(Date.parse("2026-11-26T00:00:00Z"));
  const next = await checked(post(owner, chat));
  assert.deepEqual(next.quota, { ...blankQuota, dailyRemaining: 199, monthlyRemaining: 1799, dailyResetsAt: "2026-11-27T00:00:00.000Z" });
});

test("conversation photos share the 2000-message UTC monthly cap and unrelated photo tools do not", async (t) => {
  const { seedMessages, calls, respond, charged } = setup(t);
  for (let day = 1; day <= 10; day++) seedMessages(owner, `2026-11-${String(day).padStart(2, "0")}`, day === 10 ? 199 : 200);
  t.mock.timers.setTime(Date.parse("2026-11-30T23:59:59Z"));
  const draft = { name: "米饭和煎蛋", grams: 215, calories: 346.25, protein: 14, carbs: 49, fat: 10 };
  respond(photoTool("prepare_food_photo", draft));
  const quota = { ...blankQuota, dailyRemaining: 199, monthlyRemaining: 0, dailyResetsAt: "2026-12-01T00:00:00.000Z" };
  assert.deepEqual(await checked(photoPost(owner, { ...photo, inCoach: true })), { draft, quota });
  for (const denied of [post(owner, chat), photoPost(owner, { ...photo, inCoach: true })]) {
    const blocked = await checked(denied, 429);
    assert.equal(blocked.code, "coach_monthly_limit");
    assert.deepEqual(blocked.quota, quota);
  }
  assert.equal(calls.length, 1);
  assert.equal(charged(owner), knownCost);
  assert.deepEqual(await checked(photoPost(owner, photo)), { draft });
  assert.deepEqual((await checked(get(owner))).quota, quota);

  t.mock.timers.setTime(Date.parse("2026-12-01T00:00:00Z"));
  respond(providerText);
  assert.deepEqual((await checked(post(owner, chat))).quota, { ...blankQuota, dailyRemaining: 199, monthlyRemaining: 1999,
    dailyResetsAt: "2026-12-02T00:00:00.000Z", monthlyResetsAt: "2027-01-01T00:00:00.000Z" });
  assert.equal(charged(owner, "2026-12"), knownCost);
});

test("a missing provider usage record keeps the held funds with no paid retry", async (t) => {
  const { charged, calls, respond } = setup(t);
  const diagnostics = t.mock.method(console, "error", () => {});
  respond(() => providerMessage({ usage: null, stop_reason: "end_turn", content: [{ type: "text", text: "示例建议" }] }));
  await checked(post(owner, chat));
  assert.equal(calls.length, 1);
  assert.equal(charged(owner), 1_001_875_000);
  assert.deepEqual(diagnostics.mock.calls[0].arguments, ["Spotter Anthropic usage unavailable"]);
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
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM ai_coach_budget").get().count, 0);
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
