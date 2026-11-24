import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { checkAppSource, parseArguments } from "../tools/check-app-source.mjs";

const cli = fileURLToPath(new URL("../tools/check-app-source.mjs", import.meta.url));
function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "spotter-source-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const remote = join(directory, "remote.git");
  const writer = join(directory, "other-computer");
  const app = join(directory, "app");
  git(directory, "init", "--bare", "--initial-branch=main", remote);
  git(directory, "clone", remote, writer);
  const commit = async (text) => {
    await writeFile(join(writer, "source.txt"), text);
    git(writer, "add", "source.txt");
    git(writer, "-c", "user.name=Synthetic", "-c", "user.email=source-test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "synthetic source update");
    return git(writer, "rev-parse", "HEAD");
  };
  await commit("initial synthetic source\n");
  git(writer, "push", "origin", "main");
  git(directory, "clone", remote, app);
  return { directory, remote, writer, app, commit };
}

test("source check accepts a clean checkout containing declared baselines", async (t) => {
  const { app } = await fixture(t);
  const result = checkAppSource({ cwd: app });
  assert.equal(result.status, "ready");
  assert.equal(result.freshness, "cached-remote-refs");
  assert.match(result.limitation, /--fetch/);
  assert.equal(result.upstreams[0].included, true);
  assert.equal(result.upstreams[0].missingCommits, 0);
  assert.equal(git(app, "status", "--porcelain"), "");
});

test("fetch detects another computer's pushed update and never merges it", async (t) => {
  const { app, writer, commit } = await fixture(t);
  const originalHead = git(app, "rev-parse", "HEAD");
  const latest = await commit("updated by another synthetic computer\n");
  git(writer, "push", "origin", "main");
  const blocked = checkAppSource({ cwd: app, fetch: true });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.freshness, "fetched");
  assert.equal(blocked.upstreams[0].commit, latest);
  assert.equal(blocked.upstreams[0].missingCommits, 1);
  assert.ok(blocked.reasons.includes("upstream-not-integrated"));
  assert.equal(git(app, "rev-parse", "HEAD"), originalHead);
  assert.equal(git(app, "status", "--porcelain"), "");
  git(app, "merge", "--ff-only", "origin/main");
  assert.equal(checkAppSource({ cwd: app, fetch: true }).status, "ready");
});

test("tracked and untracked changes block packaging without printing their contents", async (t) => {
  const { app } = await fixture(t);
  await writeFile(join(app, "source.txt"), "synthetic unsaved changes\n");
  await writeFile(join(app, "untracked.txt"), "synthetic private draft\n");
  const before = git(app, "status", "--porcelain");
  const result = checkAppSource({ cwd: app });
  assert.equal(result.status, "blocked");
  assert.equal(result.dirtyCount, 2);
  assert.ok(result.reasons.includes("uncommitted-source"));
  assert.equal(JSON.stringify(result).includes("synthetic private draft"), false);
  assert.equal(git(app, "status", "--porcelain"), before);
});

test("all declared branches must be integrated, including divergent work", async (t) => {
  const { app, writer, commit } = await fixture(t);
  git(writer, "switch", "-c", "device-work");
  const deviceCommit = await commit("synthetic device update\n");
  git(writer, "push", "origin", "device-work");
  const result = checkAppSource({ cwd: app, fetch: true, upstreams: ["origin/main", "origin/device-work"] });
  assert.equal(result.upstreams[0].included, true);
  assert.equal(result.upstreams[1].commit, deviceCommit);
  assert.equal(result.upstreams[1].included, false);
  assert.equal(result.status, "blocked");
});

test("missing baselines fail and transport errors do not echo remote addresses", async (t) => {
  const { app, directory } = await fixture(t);
  const missing = checkAppSource({ cwd: app, upstreams: ["origin/not-pushed"] });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.upstreams[0].reason, "missing-remote-branch");
  const absent = join(directory, "absent-remote-with-synthetic-sensitive-name.git");
  git(app, "remote", "set-url", "origin", absent);
  const failed = spawnSync(process.execPath, [cli, "--fetch"], { cwd: app, encoding: "utf8" });
  assert.equal(failed.status, 2);
  assert.equal(failed.stdout, "");
  assert.match(failed.stderr, /无法刷新远端代码/);
  assert.equal(failed.stderr.includes(absent), false);
});

test("CLI accepts repeated explicit baselines and rejects revision expressions", () => {
  assert.deepEqual(parseArguments(["--fetch", "--upstream", "origin/main", "--upstream", "origin/device-work"]), {
    fetch: true, upstreams: ["origin/main", "origin/device-work"],
  });
  assert.throws(() => parseArguments(["--unknown"]), /用法/);
  assert.throws(() => checkAppSource({ upstreams: ["origin/main..HEAD"] }), /远端跟踪分支/);
});
