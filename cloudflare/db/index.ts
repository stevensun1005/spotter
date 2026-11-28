import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Check the local Vite configuration or the deployed Worker's D1 binding."
    );
  }

  return drizzle(env.DB, { schema });
}
