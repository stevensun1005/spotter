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
 * the iPhone widget extension, the Watch app and its embedded Watch widget extension.
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
        ["SpotterWorkoutLiveActivity", "SpotterWorkoutLiveActivityWithWatch", "SpotterTrainingActivityAttributes"]);
    } catch {
      missing = ["SpotterWidget"];
    }
    if (missing.length) problems.push(`小组件扩展没有编入灵动岛界面：缺少 ${missing.join("、")}。`);
  }

  if (watch) {
    const watchPath = join(app, "Watch", "SpotterWatch.app");
    let watchApp;
    try {
      watchApp = plist(join(watchPath, "Info.plist"));
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
    if (watchApp) {
      const extensionPath = join(watchPath, "PlugIns", "SpotterWatchWidget.appex");
      let watchWidget;
      try {
        watchWidget = plist(join(extensionPath, "Info.plist"));
      } catch {
        problems.push("Apple Watch 配套 App 里没有 SpotterWatchWidget.appex，表盘和智能叠放小组件不会显示。");
      }
      if (watchWidget) {
        if (watchWidget.CFBundleIdentifier !== `${watchApp.CFBundleIdentifier}.widget` ||
            watchWidget.CFBundleVersion !== watchApp.CFBundleVersion ||
            watchWidget.CFBundleShortVersionString !== watchApp.CFBundleShortVersionString ||
            watchWidget.NSExtension?.NSExtensionPointIdentifier !== "com.apple.widgetkit-extension") {
          problems.push("Apple Watch 小组件扩展的标识、版本或扩展类型与手表 App 不一致。");
        }
        let missing;
        try {
          missing = binaryHas(join(extensionPath, watchWidget.CFBundleExecutable ?? "SpotterWatchWidget"),
            ["app.spotter.health.watch.training", "app.spotter.health.watch.next"]);
        } catch {
          missing = ["SpotterWatchWidget"];
        }
        if (missing.length) problems.push(`Apple Watch 小组件扩展缺少 ${missing.join("、")}。`);
      }
    }
  }
  return problems;
}
