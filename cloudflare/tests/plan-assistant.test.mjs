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
const { planAiPrompt, planPromptExample, agentPlanningGuide } = await import("../features/import/ai-instructions.ts");
const { parseImport, importPrompt, detectImportFormat } = await import("../features/import/parse.ts");
const { createAgentGuide } = await import("../features/agent/guide.ts");
const { agentPlanWrite } = await import("../features/agent/write-model.ts");
const today = "2026-11-24";
const profileRef = "spotter_" + "a".repeat(32);

test("chat and connected-agent instructions share valid private plan examples and separate authorization", () => {
  const example = planPromptExample(today);
  assert.equal(example.shared, false);
  assert.equal(example.exercises[0].weight, 0);
  assert.deepEqual(parseImport(JSON.stringify([example]), today), [example]);
  assert.equal(agentPlanWrite.parse({ profileRef, confirmed: true, plans: [example] }).plans[0].date, today);
  const draft = planAiPrompt(today, "create");
  const organize = planAiPrompt(today, "organize");
  assert.notEqual(draft, organize);
  assert.match(draft, /目标、每周可训练时间、器械和限制/);
  assert.match(organize, /保留原来的动作、顺序、组次和单位/);
  assert.equal(importPrompt(today), organize, "the old import entry must use the same instructions");
  for (const prompt of [draft, organize]) {
    assert.ok(prompt.includes(JSON.stringify([example])));
    assert.ok(prompt.includes(today));
    assert.ok(!prompt.includes(profileRef));
    assert.ok(!prompt.includes("Authorization:"));
    assert.ok(!prompt.includes("per100g") && !prompt.includes("read_spotter_records"));
    assert.match(prompt, /不能自行编造参考重量/);
    assert.match(prompt, /1–20/);
    assert.match(prompt, /不能.*截断/);
  }
});

test("legacy training guides reuse the staged workflow without changing data-category examples", () => {
  const origin = "https://synthetic.invalid";
  const guide = agentPlanningGuide(origin, profileRef);
  const training = createAgentGuide({ origin, profileRef, scope: "training" });
  assert.ok(training.startsWith(guide));
  assert.match(training, /stage_spotter_plans/);
  assert.match(training, /plans:write/);
  assert.match(training, /previewToken/);
  assert.match(training, /364/);
  assert.match(training, /账号说明编号只用于核对账号/);
  assert.ok(!training.includes('"per100g"'));
  for (const exerciseGuide of [training, ...["all", "templates"].map((scope) => createAgentGuide({ origin, profileRef, scope }))]) {
    assert.match(exerciseGuide, /read:context.*read_spotter_planning_context/u);
    assert.match(exerciseGuide, /标准目录 ID 一致.*规范化后完全相同的名称/u);
    assert.match(exerciseGuide, /相近变式各自保留/u);
    assert.equal(exerciseGuide.match(/## 核对动作库/gu)?.length, 1);
  }
  const food = createAgentGuide({ origin, profileRef, scope: "nutrition" });
  assert.match(food, /add_spotter_foods/);
  assert.match(food, /per100g/);
  assert.doesNotMatch(food, /## 核对动作库/u);
  assert.ok(!food.includes("## 同一条起草流程"), "other data guides must not duplicate the plan workflow");
});

test("ordinary plan import routes complete programs and backups without truncating their records", () => {
  const program = { id: crypto.randomUUID(), title: "合成完整周期", startDate: today, weeks: 4,
    phases: [], sessions: Array.from({ length: 24 }, () => ({ id: crypto.randomUUID() })) };
  const formats = [program, { format: "spotter-program", version: 1, program }];
  for (const value of formats) {
    const input = "\uFEFF```json\n" + JSON.stringify(value) + "\n```";
    assert.equal(detectImportFormat(input), "program");
    assert.throws(() => parseImport(input, today), /训练周期.*导入周期/);
    assert.equal(value.program?.sessions.length ?? value.sessions.length, 24);
  }
  const backup = JSON.stringify({ format: "spotter-backup", version: 1, training: [], library: [], heart: [] });
  assert.equal(detectImportFormat(backup), "backup");
  assert.throws(() => parseImport(backup, today), /恢复备份/);
  assert.equal(detectImportFormat("not json"), "plans");
  assert.throws(() => parseImport("[{", today), /JSON 格式有误/);
  const plans = Array.from({ length: 21 }, () => planPromptExample(today));
  assert.throws(() => parseImport(JSON.stringify(plans), today), /最多 20 堂.*21 堂/);
  assert.equal(parseImport(JSON.stringify(plans.slice(0, 20)), today).length, 20);
});

test("text and JSON inputs preserve the same prescription fields used by agent drafts", () => {
  const [text] = parseImport("上肢训练\n哑铃卧推 3×8-10次，12.5 kg · 节奏 3110", today);
  assert.equal(text.exercises[0].reps, 8);
  assert.equal(text.exercises[0].repsMax, 10);
  assert.equal(text.exercises[0].tempo, "3-1-1-0");
  const [timed] = parseImport("平板支撑 3×30-45秒", today);
  assert.equal(timed.exercises[0].seconds, 30);
  assert.equal(timed.exercises[0].repsMax, undefined, "seconds must not create a repetition range");
  const example = planPromptExample(today);
  example.exercises[0] = { ...example.exercises[0], catalogueId: "1234", block: "A", station: "哑铃区", targetRpe: 7.5,
    loadPercent: { percent: 75, reference: 100, unit: "lb" } };
  const [fromImport] = parseImport(JSON.stringify([example]), today);
  const [fromAgent] = agentPlanWrite.parse({ profileRef, confirmed: true, plans: [example] }).plans;
  assert.deepEqual(JSON.parse(JSON.stringify(fromImport)), JSON.parse(JSON.stringify(fromAgent)));
  assert.equal(fromImport.exercises[0].weight, 34.02);
  assert.equal(fromImport.exercises[0].targetRpe, 7.5);
  const explicitlyShared = { ...example, shared: true };
  assert.equal(parseImport(JSON.stringify([explicitlyShared]), today)[0].shared, true, "manual import preserves the explicit sharing choice for preview");
  assert.equal(agentPlanWrite.parse({ profileRef, confirmed: true, plans: [explicitlyShared] }).plans[0].shared, false, "an agent draft cannot inherit manual import sharing semantics");
  const [video] = parseImport("https://www.youtube.com/watch?v=synthetic", today);
  assert.deepEqual(video.exercises, []);
  assert.equal(video.minutes, 0);
  assert.equal(video.shared, false);
});
