import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const work = await mkdtemp(join(tmpdir(), "spotter-native-health-"));
try {
  const binary = join(work, "native-health-smoke");
  execFileSync("swiftc", ["-module-cache-path", join(work, "module-cache"),
    "ios/SpotterHealth/HeartPayload.swift", "ios/SpotterHealth/BridgeClient.swift",
    "ios/Tests/NativeSmoke.swift", "-o", binary], { cwd: root, stdio: "inherit" });
  execFileSync(binary, [], { cwd: root, stdio: "inherit" });
} finally {
  await rm(work, { recursive: true, force: true });
}
