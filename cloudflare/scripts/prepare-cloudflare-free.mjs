import { spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serverDirectory = path.join(projectRoot, "dist/server");
const configPath = path.join(serverDirectory, "wrangler.production.json");
const dryRunDatabaseId = "00000000-0000-4000-8000-000000000000";

async function prepare() {
  const args = process.argv.slice(2);
  const dryRun = args.length === 1 && args[0] === "--dry-run";
  if (args.length && !dryRun) throw new Error("Usage: npm run cf:prepare or npm run cf:dry-run");

  const build = JSON.parse(await readFile(path.join(serverDirectory, "wrangler.json"), "utf8"));
  if (build.main !== "index.js" || build.assets?.directory !== "../client" || !build.no_bundle) {
    throw new Error("Run npm run build to generate the Vinext Worker before preparing deployment.");
  }
  await Promise.all([access(path.join(serverDirectory, build.main)), access(path.join(serverDirectory, build.assets.directory))]);

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim().toLowerCase();
  const databaseId = process.env.SPOTTER_D1_DATABASE_ID?.trim().toLowerCase();
  if (!dryRun) {
    if (!accountId || !/^[a-f0-9]{32}$/.test(accountId)) {
      throw new Error("Set CLOUDFLARE_ACCOUNT_ID to the Cloudflare account ID.");
    }
    if (!databaseId || databaseId === dryRunDatabaseId || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(databaseId)) {
      throw new Error("Set SPOTTER_D1_DATABASE_ID to the ID of the spotter-free D1 database.");
    }
  }

  const config = {
    name: "spotter-free",
    ...(!dryRun && { account_id: accountId }),
    workers_dev: true,
    preview_urls: false,
    keep_vars: true,
    main: build.main,
    compatibility_date: build.compatibility_date,
    compatibility_flags: build.compatibility_flags,
    no_bundle: true,
    rules: build.rules,
    assets: build.assets,
    d1_databases: [{
      binding: "DB",
      database_name: "spotter-free",
      database_id: dryRun ? dryRunDatabaseId : databaseId,
      migrations_dir: "../../drizzle",
    }],
    observability: {
      enabled: true,
      logs: { enabled: true, invocation_logs: false },
    },
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Prepared dist/server/wrangler.production.json${dryRun ? " with a dry-run D1 ID" : ""}.`);

  if (dryRun) {
    const result = spawnSync(process.execPath, [
      "--import", "./scripts/cloudflare-env.mjs", "./node_modules/wrangler/bin/wrangler.js",
      "deploy", "--config", configPath, "--dry-run", "--outdir", "dist/cloudflare-dry-run",
    ], { cwd: projectRoot, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Wrangler dry run did not complete successfully.");
  }
}

try {
  await prepare();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
