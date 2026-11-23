import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });

function stableId(owner, payload) {
  const hex = createHash("sha256").update(owner).update("\0").update(payload).digest("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-8" + hex.slice(13, 16) + "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}

async function main() {
  const { values, positionals } = parseArgs({
    options: { user: { type: "string" }, "dry-run": { type: "boolean" } }, allowPositionals: true,
  });
  if (positionals.length !== 1) throw new Error("用法：npm run plans:import -- [--user 用户名] [--dry-run] 计划.json");
  const [path] = positionals;
  if (statSync(path).size > 4_000_000) throw new Error("计划文件超过 4 MB。");
  const { z } = await import("zod");
  const { planSchema } = await import("../features/plans/model.ts");
  const decoded = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const result = z.array(planSchema).min(1).max(200).safeParse(Array.isArray(decoded) ? decoded : [decoded]);
  if (!result.success) throw new Error("计划格式无效：" + result.error.issues.slice(0, 4).map(({ path, message }) => path.join(".") + " " + message).join("；"));

  const dbPath = process.env.SPOTTER_DB_PATH || resolve(".data/spotter.sqlite");
  if (!existsSync(dbPath)) throw new Error("找不到当前独立版数据库。请先开通账号，或定位已经授权的服务端数据库。");
  const { database, transaction } = await import("../server/db.ts");
  const { saveEntry } = await import("../server/entries.ts");
  const dryRun = Boolean(values["dry-run"]);
  const db = dryRun ? new DatabaseSync(dbPath, { readOnly: true }) : database();
  const username = (values.user || process.env.SPOTTER_IMPORT_USER)?.trim().toLowerCase();
  const accounts = username
    ? db.prepare("SELECT id, username FROM accounts WHERE username = ?").all(username)
    : db.prepare("SELECT id, username FROM accounts LIMIT 2").all();
  if (!accounts.length) throw new Error("目标账号不存在。");
  if (accounts.length !== 1) throw new Error("有多个账号，请用 --user 指定目标的登录用户名。");
  const { id, username: selected } = accounts[0];
  const normalized = (plan) => JSON.stringify(planSchema.parse(plan));
  const plans = result.data;
  const importPlans = () => {
    const existing = new Set(db.prepare("SELECT payload FROM entries WHERE owner = ? AND kind = 'plan'").all(id)
      .flatMap(({ payload }) => {
        const parsed = planSchema.safeParse(JSON.parse(payload));
        return parsed.success ? [JSON.stringify(parsed.data)] : [];
      }));
    let count = 0;
    for (const plan of plans) {
      const payload = normalized(plan);
      if (existing.has(payload)) continue;
      const nextId = stableId(id, payload);
      if (db.prepare("SELECT 1 FROM entries WHERE owner = ? AND id = ?").get(id, nextId)) {
        throw new Error("一条计划的导入编号已被修改，请核对已有计划再导入。");
      }
      if (!dryRun && !saveEntry(id, nextId, "plan", plan)) throw new Error("无法保存计划。");
      existing.add(payload);
      count++;
    }
    return count;
  };
  const added = dryRun ? importPlans() : transaction(db, importPlans);
  if (dryRun) db.close();
  const dates = plans.map(({ date }) => date).sort();
  console.log(JSON.stringify({ user: selected, added, skipped: plans.length - added, from: dates[0], to: dates.at(-1), dryRun }));
}

try { await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : "导入失败。");
  process.exitCode = 1;
}
