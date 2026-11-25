import { z } from "zod";
import { unchosenNames } from "./display-name";

const usernamePattern = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/;
const tagPattern = /^[0-9]{4}$/;
export const maxNicknameLength = 32;

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
  tag: z.string().max(16).transform(normalizeUsername).refine((value) => tagPattern.test(value)).optional(),
  expectedOwner: z.string().min(1).max(250),
}).strict();

export const updateNicknameInput = z.object({
  name: z.string().max(256).transform((name) => name.normalize("NFC").trim().replace(/\s+/gu, " ")).refine((name) => {
    const comparable = name.normalize("NFKC").toLowerCase();
    return name.length > 0 && Array.from(name).length <= maxNicknameLength && !/[\p{Cc}\p{Bidi_Control}@]/u.test(comparable)
      && !unchosenNames.includes(comparable);
  }),
  expectedOwner: z.string().min(1).max(250),
}).strict();

export type AccountProfile = {
  name: string;
  username: string;
  tag: string;
  handle: string;
  discoverable: boolean;
};
