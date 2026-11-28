import vinext from "vinext";
import { defineConfig } from "vite";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";
import { vinextRouteLoadLifetime } from "./scripts/vite/vinext-route-load-lifetime.mjs";

export default defineConfig(async ({ command }) => {
  configureToolEnvironment(process.cwd());
  // Wrangler reads the log path when the Cloudflare plugin is loaded.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: process.env.CODEX_SANDBOX === "seatbelt" ? { watch: { useFsEvents: false, usePolling: true } } : {},
    plugins: [
      vinext(),
      vinextRouteLoadLifetime(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: [{
            binding: "DB",
            database_name: "spotter-free",
            database_id: "00000000-0000-4000-8000-000000000000",
            migrations_dir: command === "build" ? "../../drizzle" : "./drizzle",
          }],
        },
      }),
    ],
  };
});
