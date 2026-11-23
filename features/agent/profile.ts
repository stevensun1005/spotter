import { z } from "zod";

export const profileRefSchema = z.string().regex(/^spotter_[a-f0-9]{32}$/);

// This reference matches a guide to the already authenticated Sites account.
export async function agentProfileRef(owner: string) {
  const bytes = new TextEncoder().encode("spotter:personal-agent:v1\0" + owner);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "spotter_" + Array.from(hash.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
