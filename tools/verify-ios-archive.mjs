import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAppBundle, readPlist } from "./ios-app-bundle.mjs";

// Checks the Release archive that Xcode uploads to TestFlight, not the simulator build from ios:package.
const root = fileURLToPath(new URL("../", import.meta.url));

function latestArchive() {
  const base = join(homedir(), "Library", "Developer", "Xcode", "Archives");
  if (!existsSync(base)) return null;
  const archives = readdirSync(base).flatMap((day) => {
    try {
      return readdirSync(join(base, day)).filter((name) => name.endsWith(".xcarchive")).map((name) => join(base, day, name));
    } catch {
      return [];
    }
  }).filter((path) => existsSync(join(path, "Products", "Applications", "Spotter.app")));
  archives.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return archives[0] ?? null;
}

function sourceBuildNumber() {
  const project = readFileSync(join(root, "ios/SpotterHealth.xcodeproj/project.pbxproj"), "utf8");
  return project.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1] ?? null;
}

try {
  const argument = process.argv[2];
  const archive = argument ? resolve(argument) : latestArchive();
  if (!archive) {
    throw new Error("没有找到 Spotter 的 Xcode 归档。先在 Xcode 用 Spotter scheme 执行 Product → Archive，或把 .xcarchive 路径作为参数传入。");
  }
  const app = archive.endsWith(".app") ? archive : join(archive, "Products", "Applications", "Spotter.app");
  const problems = checkAppBundle(app);
  console.log(`归档：${archive}`);
  if (existsSync(join(app, "Info.plist"))) {
    const host = readPlist(join(app, "Info.plist"));
    console.log(`版本：${host.CFBundleShortVersionString} (${host.CFBundleVersion})`);
    const source = sourceBuildNumber();
    if (source && host.CFBundleVersion !== source) {
      console.warn(`注意：归档构建号 ${host.CFBundleVersion} 与源码的 CURRENT_PROJECT_VERSION ${source} 不同，可能不是最新归档。`);
    }
  }
  if (problems.length) {
    for (const problem of problems) console.error("✗ " + problem);
    process.exitCode = 1;
  } else {
    console.log("✓ 归档包含训练搭子小组件扩展和灵动岛界面，Info.plist 已声明实时活动，Apple Watch App 完整。");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "无法检查 Xcode 归档。");
  process.exitCode = 1;
}
