import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { draftSessionSchema, planSchema, sessionSchema, type Entry, type State } from "../../workout";

import { api } from "@/server/http";
import { previewMove, reschedule } from "@/features/plans/schedule-server";
import { moveChoiceSchema, planRevisionSchema } from "@/features/plans/schedule";
import { deletePlan, writePlans } from "@/features/plans/plan-server";
import { resolvePlanTemplate } from "@/features/plans/template-link";
import { ownTemplateJoin } from "@/features/plans/template-server";
import { updateLog } from "@/features/history/update-log";
import { checkinOwnerMatches, checkinProblem } from "@/features/training/checkin-outbox";
import { buddyCheckins } from "@/features/friends/server";
import { activePair, disconnectPair, membership, sendPairCheer, validTimeZone } from "@/features/pair/server";
import { publicPartnerSession } from "@/features/friends/public-training";
import { anatomyVariant } from "@/features/body/profile";

export const dynamic = "force-dynamic";

const id = z.string().uuid();
const expectedOwner = z.string().min(1).max(300).optional();
const pairTarget = z.object({ partner: z.string().trim().min(1).max(120), connection: id });
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plans"), skipExisting: z.boolean().optional(), reviseExisting: z.boolean().optional(), items: z.array(z.object({ id, data: planSchema, revision: planRevisionSchema.nullable().optional() })).min(1).max(20) }),
  moveChoiceSchema.extend({ action: z.literal("previewMove") }),
  moveChoiceSchema.extend({ action: z.literal("move"), token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ action: z.literal("delete"), id, kind: z.enum(["plan", "draft"]), revision: planRevisionSchema.optional() }),
  z.object({ action: z.literal("draft"), id, data: draftSessionSchema, expectedOwner }),
  z.object({ action: z.literal("log"), id, data: sessionSchema, expectedOwner }),
  z.object({ action: z.literal("editLog"), id, data: sessionSchema, revision: z.string().min(1).max(40) }),
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("join"), invite: z.string().regex(/^[a-f0-9]{32}$/) }),
  pairTarget.extend({ action: z.literal("disconnect") }),
  pairTarget.extend({ action: z.literal("cheer"), timeZone: z.string().max(64).refine(validTimeZone) }),
]);

type Row = Omit<Entry, "data"> & { payload: string; templatePlan: string | null };

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "登录后可以保存到云端。" }, 401);
  if (!env.DB) return reply({ error: "云端数据库暂不可用。" }, 503);
  const me = { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  const member = await membership(env.DB, me.id);
  const partner = member?.partnerId;
  const pair = partner && member ? [member.connectionId, me.id, partner] as const : null;
  const ownCheer = pair ? " OR (e.kind = 'cheer' AND json_extract(e.payload, '$.connection') = ? " +
    "AND json_extract(e.payload, '$.recipient') = ? AND " + activePair + ")" : "";
  const partnerFilter = pair ?
    " OR (e.owner = ? AND " + activePair + " AND (e.kind = 'log' " +
    "OR (e.kind = 'plan' AND json_extract(e.payload, '$.shared') = 1) " +
    "OR (e.kind = 'cheer' AND json_extract(e.payload, '$.connection') = ? AND json_extract(e.payload, '$.recipient') = ?)))" : "";
  const ownCheerArgs = pair ? [pair[0], pair[2], ...pair] : [];
  const partnerArgs = pair ? [pair[2], ...pair, pair[0], me.id] : [];
  const [rows, partnerCheckins, stillPaired, profiles] = await Promise.all([
    env.DB.prepare("SELECT e.id, e.owner, e.kind, e.payload, e.updated, json_extract(t.payload, '$.plan') AS templatePlan FROM entries e" + ownTemplateJoin +
      "WHERE (e.owner = ? AND (e.kind IN ('plan', 'draft', 'log')" + ownCheer + "))" + partnerFilter + " ORDER BY e.updated DESC")
      .bind(me.id, me.id, ...ownCheerArgs, ...partnerArgs).all<Row>(),
    pair ? buddyCheckins(env.DB, me.id, pair[2], pair[0]) : undefined,
    pair ? env.DB.prepare("SELECT 1 WHERE " + activePair).bind(...pair).first() : undefined,
    env.DB.prepare("SELECT owner, json_extract(payload, '$.values.sex') AS variant FROM personal_library " +
      "WHERE kind = 'body-profile' AND (owner = ?" + (pair ? " OR (owner = ? AND " + activePair + ")" : "") + ")")
      .bind(me.id, ...(pair ? [pair[2], ...pair] : [])).all<{ owner: string; variant: unknown }>(),
  ]);
  const sharedPlanIds = new Set(rows.results.filter((row) => row.owner === partner && row.kind === "plan").map((row) => row.id));
  const entries: Entry[] = rows.results.flatMap(({ payload, templatePlan, ...row }): Entry[] => {
    const entry = { ...row, data: JSON.parse(payload) } as Entry;
    const own = entry.owner === me.id;
    if (!own && !stillPaired) return [];
    if (entry.kind === "cheer") return stillPaired ? [{ ...entry, data: { date: entry.data.date } }] : [];
    if (entry.kind === "plan") {
      if (!own) {
        const { templateId: _privateTemplateId, ...data } = entry.data;
        return [{ ...entry, data }];
      }
      return [templatePlan ? { ...entry, data: resolvePlanTemplate(entry.data, JSON.parse(templatePlan)) } : entry];
    }
    if (entry.kind === "log" && !own) {
      const sharedPlanId = sharedPlanIds.has(entry.data.planId) ? entry.data.planId : "";
      return [{ ...entry, updated: entry.data.date, data: publicPartnerSession(entry.data, sharedPlanId) }];
    }
    return [entry];
  });
  const variants = new Map(profiles.results.map(({ owner, variant }) => [owner, anatomyVariant(variant)]));
  const state: State = {
    me: { ...me, anatomyVariant: variants.get(me.id) }, entries,
    room: member && (!partner || stillPaired) ? {
      connectionId: member.connectionId,
      invite: member.creator === me.id && !partner ? member.invite : null,
      partner: partner ? { id: partner, name: member.partnerName || "搭子", anatomyVariant: variants.get(partner) } : null,
      ...(partner ? { partnerCheckins, partnerTrainingShared: true } : {}),
    } : null,
  };
  return reply(state);
}

export const POST = api(async (request) => {
  const user = await getChatGPTUser();
  const db = env.DB;
  if (!user) return reply({ error: "请登录后再保存。" }, 401);
  if (!db) return reply({ error: "云端数据库暂不可用。" }, 503);
  if (request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "请求格式无效。" }, 403);
  }
  const raw = await request.text();
  if (raw.length > 500_000) return reply({ error: "内容太长，请分批导入。" }, 413);
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return reply({ error: "请求格式无效。" }, 400);
  }
  const result = mutation.safeParse(decoded);
  if (!result.success) return reply({ error: "有字段超出允许范围，请检查后重试。" }, 400);
  const body = result.data;
  const owner = user.userId;
  const name = user.fullName || user.email.split("@")[0];
  const now = new Date().toISOString();
  const save = (itemId: string, kind: Entry["kind"], data: unknown) => db.prepare(
    "INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload, updated = excluded.updated " +
    "WHERE entries.kind = 'draft' AND excluded.kind IN ('draft', 'log')"
  ).bind(owner, itemId, kind, JSON.stringify(data), now);

  if (body.action === "previewMove") {
    return reply(await previewMove(db, owner, body));
  } else if (body.action === "move") {
    return reply(await reschedule(db, owner, body, body.token, now));
  } else if (body.action === "delete") {
    if (body.kind === "plan") {
      await deletePlan(db, owner, body.id, body.revision, now);
      return reply({ ok: true });
    }
    const removed = await db.prepare(
      "INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, '{}', ?) " +
      "ON CONFLICT(owner, id) DO UPDATE SET kind = excluded.kind, payload = '{}', updated = excluded.updated WHERE entries.kind = ? OR entries.kind = excluded.kind"
    ).bind(owner, body.id, "deleted-" + body.kind, now, body.kind).run();
    if (!removed.meta.changes) return reply({ error: "这条记录已变更，无法删除。" }, 409);
  } else if (body.action === "plans") {
    return reply(await writePlans(db, owner, body.items, now, body));
  } else if (body.action === "editLog") {
    return reply(await updateLog(db, owner, body.id, body.revision, body.data, now));
  } else if (body.action === "draft" || body.action === "log") {
    if (!checkinOwnerMatches(owner, body.expectedOwner)) {
      return reply({ error: "登录账号已切换。切回记录训练的账号后同步。", code: "account_mismatch" }, 403);
    }
    if (body.action === "log") {
      const problem = checkinProblem(body.data);
      if (problem) return reply({ error: problem }, 400);
    } else if (body.data.finishedVideo && !body.data.plan.video) {
      return reply({ error: "这次训练没有视频链接。" }, 400);
    }
    const saved = await save(body.id, body.action, body.data).run();
    if (!saved.meta.changes && body.action === "draft") return reply({ error: "此训练已打卡，草稿不能继续修改。" }, 409);
    if (body.action === "log") {
      if (saved.meta.changes) return reply({ data: body.data, updated: now });
      const previous = await db.prepare("SELECT payload, updated FROM entries WHERE owner = ? AND id = ? AND kind = 'log'")
        .bind(owner, body.id).first<{ payload: string; updated: string }>();
      return previous ? reply({ data: JSON.parse(previous.payload), updated: previous.updated }) : reply({ error: "这条训练已变更，请刷新后重试。" }, 409);
    }
  } else if (body.action === "create") {
    if (!await membership(db, owner)) {
      const room = crypto.randomUUID();
      try {
        await db.batch([
          db.prepare("INSERT INTO rooms (id, invite, owner) VALUES (?, ?, ?)").bind(room, crypto.randomUUID().replace(/-/g, ""), owner),
          db.prepare("INSERT INTO members (user, room, name) VALUES (?, ?, ?)").bind(owner, room, name),
        ]);
      } catch (error) {
        if (!await membership(db, owner)) throw error;
      }
    }
  } else if (body.action === "join") {
    const joined = await db.prepare(
      "INSERT OR IGNORE INTO members (user, room, name) " +
      "SELECT ?, r.id, ? FROM rooms r WHERE r.invite = ? " +
      "AND (SELECT COUNT(*) FROM members m WHERE m.room = r.id) = 1"
    ).bind(owner, name, body.invite).run();
    if (!joined.meta.changes) return reply({ error: "邀请码无效、搭子已满，或你已有搭子空间。" }, 409);
  } else if (body.action === "disconnect") {
    await disconnectPair(db, owner, body.partner, body.connection);
  } else if (body.action === "cheer") {
    await sendPairCheer(db, owner, body.partner, body.connection, body.timeZone);
  }
  return reply({ ok: true });
});
