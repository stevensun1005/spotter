import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "spotter-app-check-"));
const shared = ["ios/SpotterHealth/HeartPayload.swift", "ios/SpotterHealth/BridgeClient.swift"];
const checks = [
  ["navigation", ["ios/SpotterHealth/AppConfiguration.swift", "ios/SpotterHealth/SpotterWebAppearance.swift", "ios/Tests/AppPolicySmoke.swift"]],
  ["health-binding", [...shared, "ios/Tests/HealthAccountGateSmoke.swift"]],
  ["account-session", [...shared, "ios/SpotterHealth/AppSession.swift", "ios/Tests/AppSessionSmoke.swift"]],
];

function checkGlassScript(binary) {
  const origin = "https://appearance.spotter.test";
  const script = execFileSync(binary, ["--appearance-script", origin], { encoding: "utf8" });
  const styles = [];
  const document = {
    head: { append: (style) => styles.push(style) },
    createElement(tag) { assert.equal(tag, "style"); return {}; },
    getElementById: (id) => styles.find((style) => style.id === id),
  };
  for (const location of [origin + ".invalid", origin + ":444", "http://appearance.spotter.test", "https://chatgpt.com"]) {
    const window = { location: { origin: location } };
    window.top = window;
    runInNewContext(script, { document, window });
  }
  runInNewContext(script, { document, window: { location: { origin }, top: {} } });
  assert.equal(styles.length, 0);

  const window = { location: { origin } };
  window.top = window;
  runInNewContext(script, { document, window });
  runInNewContext(script, { document, window });
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, /\.primary-nav > \.primary-nav-tabs > button/);
  assert.doesNotMatch(styles[0].textContent, /primary-nav-coach/);
  console.log("PASS app glass appearance: trusted main frame, one scoped stylesheet, AI button excluded");
}

try {
  for (const [name, sources] of checks) {
    const binary = join(directory, name);
    execFileSync("swiftc", ["-module-cache-path", join(directory, "module-cache"), ...sources, "-o", binary], {
      cwd: root, stdio: ["ignore", "pipe", "pipe"],
    });
    const output = execFileSync(binary, [], { encoding: "utf8" });
    console.log(output.trim());
    if (name === "navigation") checkGlassScript(binary);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
