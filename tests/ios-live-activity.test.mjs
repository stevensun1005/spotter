import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkAppBundle } from "../tools/ios-app-bundle.mjs";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Matches both this hand-written project file and the layout Xcode writes when it saves the project.
const ref = (id) => `${id}(?: /\\*[^*]*\\*/)?`;

function buildPhase(project, id) {
  const match = project.match(new RegExp(`${ref(id)} = \\{\\s*isa = PBX\\w+BuildPhase;[\\s\\S]*?files = \\(([^)]*)\\)`));
  assert.ok(match, `build phase ${id} exists`);
  return match[1];
}

function buildFileFor(project, filename, phaseFiles) {
  const ids = [...project.matchAll(new RegExp(`([0-9A-F]{24}) /\\* ${filename.replace(".", "\\.")} in Sources \\*/ = \\{\\s*isa = PBXBuildFile`, "g"))]
    .map((match) => match[1]);
  return ids.some((id) => phaseFiles.includes(id));
}

test("the Spotter project ships the Live Activity in both Debug and Release", async () => {
  const project = await source("ios/SpotterHealth.xcodeproj/project.pbxproj");
  const plist = await source("ios/SpotterHealth/Info.plist");
  assert.match(plist, /<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);

  const appSources = buildPhase(project, "A13000000000000000000008");
  const widgetSources = buildPhase(project, "A1300000000000000000008F");
  assert.ok(buildFileFor(project, "SpotterTrainingActivityAttributes.swift", appSources), "app compiles the attributes");
  assert.ok(buildFileFor(project, "NativeTrainingLiveActivity.swift", appSources), "app compiles the manager");
  assert.ok(buildFileFor(project, "SpotterTrainingActivityAttributes.swift", widgetSources), "widget compiles the attributes");
  assert.ok(buildFileFor(project, "SpotterWorkoutLiveActivity.swift", widgetSources), "widget compiles the Dynamic Island UI");

  const embed = project.match(/A1300000000000000000008C \/\* Embed App Extensions \*\/ = \{([\s\S]*?)\};/)?.[1] ?? "";
  assert.match(embed, /dstSubfolderSpec = 13;/);
  assert.match(embed, /SpotterWidget\.appex in Embed App Extensions/);
  assert.match(embed, /runOnlyForDeploymentPostprocessing = 0;/);
  assert.match(project, /buildPhases = \([^)]*A1300000000000000000008C \/\* Embed App Extensions \*\/[^)]*\);\s*buildRules = \(\s*\);\s*dependencies = \(\s*A1300000000000000000008E/);

  const widgetConfig = (id) => project.match(new RegExp(`${ref(id)} = \\{\\s*isa = XCBuildConfiguration;\\s*buildSettings = \\{([\\s\\S]*?)\\};\\s*name = (\\w+);`));
  const debug = widgetConfig("A13000000000000000000093");
  const release = widgetConfig("A13000000000000000000094");
  assert.equal(debug[2], "Debug");
  assert.equal(release[2], "Release");
  assert.equal(release[1], debug[1], "widget Release settings match Debug");
  assert.match(release[1], /SKIP_INSTALL = YES;/);

  for (const scheme of ["Spotter", "SpotterHealth"]) {
    const xml = await source(`ios/SpotterHealth.xcodeproj/xcshareddata/xcschemes/${scheme}.xcscheme`);
    assert.match(xml, /buildImplicitDependencies\s*=\s*"YES"/);
    assert.match(xml, /buildForArchiving\s*=\s*"YES"/);
    assert.match(xml, /<ArchiveAction\b[^>]*\bbuildConfiguration\s*=\s*"Release"/);
  }

  const bundle = await source("ios/SpotterWidget/SpotterWidget.swift");
  assert.match(bundle, /struct SpotterWidgets: WidgetBundle[\s\S]*SpotterWorkoutLiveActivity\(\)/);
});

test("a running workout's activity is not latched off after iOS ends it", async () => {
  const manager = await source("ios/SpotterHealth/NativeTrainingLiveActivity.swift");
  // The old latch blocked every later start for a workout once one request had succeeded.
  assert.doesNotMatch(manager, /set\([^)]*legacyStartedKey/);
  assert.match(manager, /removeObject\(forKey: Self\.legacyStartedKey\)/);
  assert.match(manager, /activityEnablementUpdates/);
  assert.match(manager, /activityStateUpdates/);
  assert.match(manager, /requestProblem = Self\.describe\(error\)/);

  const app = await source("ios/SpotterHealth/NativeApp.swift");
  assert.match(app, /if !restoring && !account\.isSessionLocked \{[\s\S]{0,200}clearTrainingLiveActivity\(\)/);
  assert.match(app, /protectedDataDidBecomeAvailableNotification/);

  const settings = await source("ios/SpotterHealth/NativeWebSecondary.swift");
  assert.match(settings, /NativeLiveActivityStatus\(manager: \.shared\)/);
  assert.match(settings, /UIApplication\.openSettingsURLString/);
});

async function fakeApp(t, { liveActivities = true, widget = true, widgetBinary = "SpotterWorkoutLiveActivity SpotterTrainingActivityAttributes", debugDylib = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "spotter-bundle-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const app = join(directory, "Spotter.app");
  const version = { CFBundleVersion: "51", CFBundleShortVersionString: "1.0.1" };
  const write = async (path, value) => {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, typeof value === "string" ? value : JSON.stringify(value));
  };
  await write(join(app, "Info.plist"), {
    CFBundleIdentifier: "app.spotter.health", CFBundleExecutable: "Spotter", ...version,
    ...(liveActivities ? { NSSupportsLiveActivities: true } : {}),
  });
  if (debugDylib) {
    await write(join(app, "Spotter"), "stub");
    await write(join(app, "Spotter.debug.dylib"), "\0SpotterTrainingActivityAttributes\0");
  } else {
    await write(join(app, "Spotter"), "\0SpotterTrainingActivityAttributes\0");
  }
  if (widget) {
    const appex = join(app, "PlugIns", "SpotterWidget.appex");
    await write(join(appex, "Info.plist"), {
      CFBundleIdentifier: "app.spotter.health.widget", CFBundleExecutable: "SpotterWidget", ...version,
      NSExtension: { NSExtensionPointIdentifier: "com.apple.widgetkit-extension" },
    });
    await write(join(appex, "SpotterWidget"), `\0${widgetBinary}\0`);
  }
  await write(join(app, "Watch", "SpotterWatch.app", "Info.plist"), {
    CFBundleIdentifier: "app.spotter.health.watchkitapp", ...version, WKCompanionAppBundleIdentifier: "app.spotter.health",
    WKApplication: true, WKBackgroundModes: ["workout-processing"],
  });
  return app;
}

const jsonPlist = (path) => JSON.parse(readFileSync(path, "utf8"));

test("bundle check accepts a complete app, including Xcode debug dylibs", async (t) => {
  assert.deepEqual(checkAppBundle(await fakeApp(t), { plist: jsonPlist }), []);
  assert.deepEqual(checkAppBundle(await fakeApp(t, { debugDylib: true }), { plist: jsonPlist }), []);
});

test("bundle check reports what keeps the Dynamic Island from showing", async (t) => {
  const missingKey = checkAppBundle(await fakeApp(t, { liveActivities: false }), { plist: jsonPlist });
  assert.equal(missingKey.length, 1);
  assert.match(missingKey[0], /NSSupportsLiveActivities/);

  const noWidget = checkAppBundle(await fakeApp(t, { widget: false }), { plist: jsonPlist });
  assert.equal(noWidget.length, 1);
  assert.match(noWidget[0], /SpotterWidget\.appex/);

  const noIsland = checkAppBundle(await fakeApp(t, { widgetBinary: "SpotterBuddyWidget" }), { plist: jsonPlist });
  assert.equal(noIsland.length, 1);
  assert.match(noIsland[0], /SpotterWorkoutLiveActivity/);
});
