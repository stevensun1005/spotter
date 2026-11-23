import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { asDate, planSchema, sessionSchema, sessionTotals, type Entry, type State } from "../../workout";

export const dynamic = "force-dynamic";

const id = z.string().uuid();
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plans"), items: z.array(z.object({ id, data: planSchema })).min(1).max(20) }),
  z.object({ action: z.literal("draft"), id, data: sessionSchema }),
  z.object({ action: z.literal("log"), id, data: sessionSchema }),
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("join"), invite: z.string().regex(/^[a-f0-9]{32}$/) }),
  z.object({ action: z.literal("cheer") }),
]);

type Member = { invite: string; creator: string; partnerId: string | null; partnerName: string | null };
type Row = Omit<Entry, "data"> & { payload: string };

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function membership(db: D1Database, user: string) {
  return db.prepare(
    "SELECT r.invite, r.owner AS creator, p.user AS partnerId, p.name AS partnerName " +
    "FROM members m JOIN rooms r ON r.id = m.room " +
    "LEFT JOIN members p ON p.room = m.room AND p.user <> m.user WHERE m.user = ?"
  ).bind(user).first<Member>();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "登录后可以保存到云端。" }, 401);
  if (!env.DB) return reply({ error: "云端数据库暂不可用。" }, 503);
  const me = { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  const member = await membership(env.DB, me.id);
  const rows = await env.DB.prepare(
    "SELECT id, owner, kind, payload, updated FROM entries " +
    "WHERE owner = ? OR (owner = ? AND kind IN ('plan', 'log', 'cheer')) ORDER BY updated DESC"
  ).bind(me.id, member?.partnerId ?? null).all<Row>();
  const entries: Entry[] = rows.results.map(({ payload, ...row }) => ({ ...row, data: JSON.parse(payload) } as Entry))
    .filter((entry) => entry.kind !== "plan" || entry.owner === me.id || entry.data.shared);
  const state: State = {
    me, entries,
    room: member ? {
      invite: member.creator === me.id && !member.partnerId ? member.invite : null,
      partner: member.partnerId ? { id: member.partnerId, name: member.partnerName || "搭子" } : null,
    } : null,
  };
  return reply(state);
}

export async function POST(request: Request) {
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
    "WHERE (entries.kind = 'draft' AND excluded.kind IN ('draft', 'log')) OR (entries.kind = 'plan' AND excluded.kind = 'plan')"
  ).bind(owner, itemId, kind, JSON.stringify(data), now);

  if (body.action === "plans") {
    await db.batch(body.items.map((item) => save(item.id, "plan", item.data)));
  } else if (body.action === "draft" || body.action === "log") {
    if (body.action === "log" && !body.data.finishedVideo && sessionTotals(body.data).sets === 0) {
      return reply({ error: "请至少完成一组动作或标记视频跟练完成。" }, 400);
    }
    if (body.data.finishedVideo && !body.data.plan.video) return reply({ error: "这次训练没有视频链接。" }, 400);
    const saved = await save(body.id, body.action, body.data).run();
    if (!saved.meta.changes && body.action === "draft") return reply({ error: "此训练已打卡，草稿不能继续修改。" }, 409);
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
  } else if (body.action === "cheer") {
    if (!(await membership(db, owner))?.partnerId) return reply({ error: "配对后可以给搭子加油。" }, 409);
    const date = asDate();
    await save("cheer-" + date, "cheer", { date }).run();
  }
  return reply({ ok: true });
}
