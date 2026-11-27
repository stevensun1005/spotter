import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readPlist(plist) {
  return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8" }));
}

// Debug builds from Xcode 15 and later keep the code in <executable>.debug.dylib next to a small stub.
function binaryHas(path, names) {
  const binaries = [readFileSync(path)];
  if (existsSync(path + ".debug.dylib")) binaries.push(readFileSync(path + ".debug.dylib"));
  return names.filter((name) => !binaries.some((binary) => binary.includes(name)));
}

/**
 * Checks a built Spotter.app (simulator build or the Release app inside an .xcarchive):
 * the widget extension that draws the Lock Screen and Dynamic Island Live Activity, and the Watch app.
 * Returns a list of problems in Chinese; an empty list means the bundle is complete.
 */
export function checkAppBundle(app, { plist = readPlist, watch = true } = {}) {
  const problems = [];
  let host;
  try {
    host = plist(join(app, "Info.plist"));
  } catch {
    return [`找不到 App 的 Info.plist：${app}`];
  }
  if (host.NSSupportsLiveActivities !== true) {
    problems.push("App 的 Info.plist 没有 NSSupportsLiveActivities，iOS 不会显示锁屏实时活动和灵动岛。");
  }
  let hostMissing;
  try {
    hostMissing = binaryHas(join(app, host.CFBundleExecutable ?? "Spotter"), ["SpotterTrainingActivityAttributes"]);
  } catch {
    hostMissing = ["Spotter"];
  }
  if (hostMissing.length) problems.push("App 主程序没有编入训练实时活动（SpotterTrainingActivityAttributes）。");

  const appex = join(app, "PlugIns", "SpotterWidget.appex");
  let widget;
  try {
    widget = plist(join(appex, "Info.plist"));
  } catch {
    problems.push("App 里没有训练搭子小组件扩展 PlugIns/SpotterWidget.appex，锁屏实时活动和灵动岛无法显示。");
  }
  if (widget) {
    if (widget.CFBundleIdentifier !== `${host.CFBundleIdentifier}.widget` ||
        widget.CFBundleVersion !== host.CFBundleVersion ||
        widget.CFBundleShortVersionString !== host.CFBundleShortVersionString ||
        widget.NSExtension?.NSExtensionPointIdentifier !== "com.apple.widgetkit-extension") {
      problems.push("小组件扩展的标识、版本或扩展类型与 App 不一致。");
    }
    let missing;
    try {
      missing = binaryHas(join(appex, widget.CFBundleExecutable ?? "SpotterWidget"),
        ["SpotterWorkoutLiveActivity", "SpotterTrainingActivityAttributes"]);
    } catch {
      missing = ["SpotterWidget"];
    }
    if (missing.length) problems.push(`小组件扩展没有编入灵动岛界面：缺少 ${missing.join("、")}。`);
  }

  if (watch) {
    let watchApp;
    try {
      watchApp = plist(join(app, "Watch", "SpotterWatch.app", "Info.plist"));
    } catch {
      problems.push("App 里没有 Apple Watch 配套 App。");
    }
    if (watchApp && (watchApp.CFBundleIdentifier !== `${host.CFBundleIdentifier}.watchkitapp` ||
        watchApp.CFBundleVersion !== host.CFBundleVersion ||
        watchApp.CFBundleShortVersionString !== host.CFBundleShortVersionString ||
        watchApp.WKCompanionAppBundleIdentifier !== host.CFBundleIdentifier || watchApp.WKApplication !== true ||
        !watchApp.WKBackgroundModes?.includes("workout-processing"))) {
      problems.push("Apple Watch 配套 App 的标识、版本或训练后台模式与 App 不一致。");
    }
  }
  return problems;
}
