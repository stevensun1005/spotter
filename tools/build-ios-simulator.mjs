import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { checkAppSource } from "./check-app-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const baselines = ["origin/main", "origin/codex/health-device-sync", "origin/codex/spotter-iphone-app"];
const app = "work/app-derived/Build/Products/Debug-iphonesimulator/Spotter.app";

function checkedWebRelease(plist) {
  const { SpotterWebRelease: release } = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist], {
    cwd: root, encoding: "utf8",
  }));
  const url = new URL(release?.origin);
  const sha = /^[a-f0-9]{40}$/;
  const sitesSnapshot = /^origin\/sites\/[a-zA-Z0-9._-]+$/.test(release.exportRef);
  const cloudflareSource = release.hosting === "cloudflare" && release.exportRef === "origin/codex/cloudflare-free" &&
      release.exportCommit === release.sourceCommit;
  if (url.protocol !== "https:" || url.origin !== release.origin || !Number.isSafeInteger(release.version) || release.version < 1 ||
      !(sitesSnapshot || cloudflareSource) || !sha.test(release.sourceCommit) || !sha.test(release.exportCommit)) {
    throw new Error("请在 Info.plist 核对默认站点的已发布版本和源码快照。");
  }
  let remoteCommit;
  try {
    remoteCommit = execFileSync("git", ["rev-parse", "--verify", `refs/remotes/${release.exportRef}^{commit}`], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("GitHub 上缺少已核对的站点源码快照分支。");
  }
  if (remoteCommit !== release.exportCommit) throw new Error("站点源码快照已更新，请先核对发布版本和源码再打包。");
  return release;
}

function checkedSource() {
  const source = checkAppSource({ cwd: root, fetch: true, upstreams: baselines });
  if (source.status !== "ready") throw new Error(source.message + " " + source.reasons.join(", "));
  return source;
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("App 构建或打包未完成，请检查上一条命令的结果。");
}

try {
  const before = checkedSource();
  const webBefore = checkedWebRelease("ios/SpotterHealth/Info.plist");
  run("xcodebuild", ["-quiet", "-project", "ios/SpotterHealth.xcodeproj", "-scheme", "Spotter", "-sdk", "iphonesimulator",
    "-configuration", "Debug", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", "work/app-derived",
    "CODE_SIGNING_ALLOWED=NO", "build"]);
  const after = checkedSource();
  if (before.head !== after.head) throw new Error("构建期间源码发生变化，请重新打包。");
  const webRelease = checkedWebRelease(join(app, "Info.plist"));
  if (!Object.keys(webBefore).every((key) => webBefore[key] === webRelease[key])) {
    throw new Error("App 内的网页版本记录与源码不一致，请重新打包。");
  }
  await mkdir(join(root, "outputs"), { recursive: true });
  const name = "Spotter-Simulator-" + after.head.slice(0, 8);
  const archive = join(root, "outputs", name + ".zip");
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", join(root, app), archive]);
  const manifest = {
    kind: "spotter-ios-simulator-development-build", createdAt: new Date().toISOString(),
    commit: after.head, branch: after.branch, baselines: after.upstreams,
    sourceFreshness: after.freshness, platform: "iOS Simulator", signedForPhysicalDevice: false,
    webRelease,
    webDelivery: "Uses the verified Cloudflare HTTPS API. App views are implemented in SwiftUI.",
    latestScope: "Includes only commits fetched into the declared baselines at packaging time. Other-computer unpublished work must be integrated after the user supplies it.",
  };
  await writeFile(join(root, "outputs", name + ".json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("已生成模拟器开发版：" + archive);
} catch (error) {
  console.error(error instanceof Error ? error.message : "App 打包失败。");
  process.exitCode = 1;
}
