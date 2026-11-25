import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim().toLowerCase();
const database = process.env.SPOTTER_D1_DATABASE_ID?.trim().toLowerCase();
if (!account || !/^[a-f0-9]{32}$/.test(account) || !database ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(database)) {
  throw new Error("Set CLOUDFLARE_ACCOUNT_ID and the D1 ID of the existing spotter-free database.");
}

const work = new URL("../work/", import.meta.url);
const output = new URL("spotter-beta-api.wrangler.json", work);
await mkdir(work, { recursive: true });
await writeFile(output, JSON.stringify({
  name: "spotter-beta-api",
  account_id: account,
  main: "../worker/beta-social.ts",
  compatibility_date: "2026-11-25",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  preview_urls: false,
  d1_databases: [{ binding: "DB", database_name: "spotter-free", database_id: database, migrations_dir: "../drizzle" }],
  observability: { enabled: false },
}, null, 2) + "\n");
console.log("Prepared the beta Worker configuration at " + fileURLToPath(output));
