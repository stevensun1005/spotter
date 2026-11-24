import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "spotter-app-check-"));
const shared = ["ios/SpotterHealth/HeartPayload.swift", "ios/SpotterHealth/BridgeClient.swift"];
const checks = [
  ["navigation", ["ios/SpotterHealth/AppConfiguration.swift", "ios/Tests/AppPolicySmoke.swift"]],
  ["health-binding", [...shared, "ios/Tests/HealthAccountGateSmoke.swift"]],
  ["account-session", [...shared, "ios/SpotterHealth/AppSession.swift", "ios/Tests/AppSessionSmoke.swift"]],
];
try {
  for (const [name, sources] of checks) {
    const binary = join(directory, name);
    execFileSync("swiftc", ["-module-cache-path", join(directory, "module-cache"), ...sources, "-o", binary], {
      cwd: root, stdio: ["ignore", "pipe", "pipe"],
    });
    const output = execFileSync(binary, [], { encoding: "utf8" });
    console.log(output.trim());
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
