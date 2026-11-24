import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

class SourceCheckError extends Error {
  constructor(message) { super(message); this.name = "SourceCheckError"; }
}

function git(cwd, args, allowed = [0]) {
  const result = spawnSync("git", args, {
    cwd, encoding: "utf8", timeout: 30_000, maxBuffer: 1_000_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || !allowed.includes(result.status)) {
    // Git transport errors may include credential-bearing URLs. Do not echo stderr.
    throw new SourceCheckError(args[0] === "fetch"
      ? "无法刷新远端代码。请检查仓库访问和网络后重新运行检查；未合并或覆盖任何源码。"
      : "无法核验 Git 源码状态。请确认当前目录属于有效仓库、HEAD 和远端分支可读取。");
  }
  return { status: result.status, text: result.stdout.trim() };
}

export function parseArguments(args) {
  const options = { fetch: false, upstreams: [] };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--fetch") options.fetch = true;
    else if (args[index] === "--upstream" && args[index + 1] && !args[index + 1].startsWith("-")) options.upstreams.push(args[++index]);
    else throw new SourceCheckError("用法：node tools/check-app-source.mjs [--fetch] [--upstream origin/main]（--upstream 可重复）。");
  }
  if (!options.upstreams.length) options.upstreams.push("origin/main");
  options.upstreams = [...new Set(options.upstreams)];
  return options;
}

export function checkAppSource({ cwd = process.cwd(), fetch = false, upstreams = ["origin/main"] } = {}) {
  if (!upstreams.length || upstreams.some((ref) => typeof ref !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref) || ref.includes(".."))) {
    throw new SourceCheckError("请用 --upstream 指定远端跟踪分支，例如 origin/main。");
  }
  git(cwd, ["rev-parse", "--show-toplevel"]);
  if (fetch) git(cwd, ["fetch", "--all", "--prune"]);
  const head = git(cwd, ["rev-parse", "--verify", "HEAD^{commit}"]).text;
  const branch = git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1]).text || null;
  const dirty = git(cwd, ["status", "--porcelain=v1", "--untracked-files=normal"]).text;
  const reasons = dirty ? ["uncommitted-source"] : [];
  const checked = [];
  for (const ref of [...new Set(upstreams)]) {
    const symbolic = git(cwd, ["rev-parse", "--symbolic-full-name", "--verify", "--end-of-options", ref], [0, 128]).text;
    if (!symbolic.startsWith("refs/remotes/")) {
      checked.push({ ref, included: false, reason: "missing-remote-branch" });
      reasons.push("missing-upstream");
      continue;
    }
    const commit = git(cwd, ["rev-parse", "--verify", "--end-of-options", symbolic + "^{commit}"]).text;
    const included = git(cwd, ["merge-base", "--is-ancestor", commit, head], [0, 1]).status === 0;
    const missingCommits = Number(git(cwd, ["rev-list", "--count", head + ".." + commit]).text);
    checked.push({ ref, commit, included, missingCommits });
    if (!included) reasons.push("upstream-not-integrated");
  }
  // A concurrent commit or fetch must not turn an earlier snapshot into a passing build gate.
  const sameHead = git(cwd, ["rev-parse", "HEAD"]).text === head;
  const sameWorktree = git(cwd, ["status", "--porcelain=v1", "--untracked-files=normal"]).text === dirty;
  const sameRefs = checked.every((item) => !item.commit || git(cwd, ["rev-parse", "--verify", "--end-of-options", item.ref + "^{commit}"]).text === item.commit);
  if (!sameHead || !sameWorktree || !sameRefs) reasons.push("source-changed-during-check");
  return {
    status: reasons.length ? "blocked" : "ready",
    branch, head, freshness: fetch ? "fetched" : "cached-remote-refs",
    dirtyCount: dirty ? dirty.split("\n").length : 0,
    upstreams: checked, reasons: [...new Set(reasons)],
    message: reasons.length
      ? "源码检查未通过。先保留本地改动、整合列出的远端更新并提交，再重新检查；工具没有自动合并或覆盖文件。"
      : "当前 HEAD 已包含列出的远端基线，工作区干净。",
    limitation: fetch
      ? "仅核验这次拉取时已推送到所列分支的代码；另一台电脑未提交、未推送、其他分支及 Sites 的更新不在此检查范围内。"
      : "本次未联网拉取，只检查缓存的远端引用；最终打包前请使用 --fetch。另一台电脑未提交、未推送及 Sites 的更新无法由此读取。",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = checkAppSource(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "ready" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof SourceCheckError ? error.message : "源码检查失败；未输出 Git 连接详情或凭据。");
    process.exitCode = 2;
  }
}
