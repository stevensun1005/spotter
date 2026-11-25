import { z } from "zod";

const usernamePattern = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/;
const tagPattern = /^[0-9]{4}$/;

export function normalizeUsername(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function parseHandleQuery(raw: string): { username: string; tag?: string } | null {
  const [username, tag, extra] = normalizeUsername(raw).split("#");
  if (!usernamePattern.test(username) || extra !== undefined || (tag !== undefined && !tagPattern.test(tag))) return null;
  return tag === undefined ? { username } : { username, tag };
}

export const updateProfileInput = z.object({
  username: z.string().max(80).transform(normalizeUsername).refine((value) => usernamePattern.test(value)),
  expectedOwner: z.string().min(1).max(250),
}).strict();

export type AccountProfile = {
  username: string;
  tag: string;
  handle: string;
  discoverable: boolean;
};
