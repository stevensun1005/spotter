import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { checkAppSource } from "./check-app-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const baselines = ["origin/main", "origin/codex/health-device-sync", "origin/codex/spotter-iphone-app"];
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
  run("xcodebuild", ["-quiet", "-project", "ios/SpotterHealth.xcodeproj", "-scheme", "Spotter", "-sdk", "iphonesimulator",
    "-configuration", "Debug", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", "work/app-derived",
    "CODE_SIGNING_ALLOWED=NO", "build"]);
  const after = checkedSource();
  if (before.head !== after.head) throw new Error("构建期间源码发生变化，请重新打包。");
  await mkdir(join(root, "outputs"), { recursive: true });
  const name = "Spotter-Simulator-" + after.head.slice(0, 8);
  const archive = join(root, "outputs", name + ".zip");
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", join(root, "work/app-derived/Build/Products/Debug-iphonesimulator/Spotter.app"), archive]);
  const manifest = {
    kind: "spotter-ios-simulator-development-build", createdAt: new Date().toISOString(),
    commit: after.head, branch: after.branch, baselines: after.upstreams,
    sourceFreshness: after.freshness, platform: "iOS Simulator", signedForPhysicalDevice: false,
    webDelivery: "Loads the selected HTTPS site's published code; web business modules are not copied into this binary.",
    latestScope: "Includes only commits fetched into the declared baselines at packaging time. Other-computer unpublished work must be integrated after the user supplies it.",
  };
  await writeFile(join(root, "outputs", name + ".json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("已生成模拟器开发版：" + archive);
} catch (error) {
  console.error(error instanceof Error ? error.message : "App 打包失败。");
  process.exitCode = 1;
}
