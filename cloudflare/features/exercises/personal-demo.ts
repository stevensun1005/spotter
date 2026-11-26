import { HttpError } from "@/server/http";
import { blankProfile } from "@/features/library/model";
import { exerciseIdentityNameKey, parsePlanMove } from "./move-name";

export const demoMaxBytes = 768 * 1024;
export const demoMaxBase64 = Math.ceil(demoMaxBytes / 3) * 4;

const gifError = () => new HttpError(400, "请选择 768 KB 以内的 GIF 动图，最长边不超过 480 像素。");
const demoName = (name: string) => parsePlanMove(name, { preserveQualifiers: true }).name;
const nameKey = (name: string) => exerciseIdentityNameKey(demoName(name));

export function gifData(image: string): Uint8Array<ArrayBuffer> {
  try { return Uint8Array.from(atob(image), (character) => character.charCodeAt(0)); }
  catch { throw gifError(); }
}

function segmentsEnd(bytes: Uint8Array, start: number) {
  let cursor = start;
  while (cursor < bytes.length) {
    const count = bytes[cursor++];
    if (!count) return cursor;
    cursor += count;
  }
  throw gifError();
}

function cleanGif(image: string) {
  if (image.length > demoMaxBase64 || image.length % 4 || !/^[0-9A-Za-z+/]+={0,2}$/u.test(image)) throw gifError();
  const bytes = gifData(image);
  const header = String.fromCharCode(...bytes.subarray(0, 6));
  if (bytes.length < 14 || bytes.length > demoMaxBytes || !["GIF87a", "GIF89a"].includes(header)) throw gifError();
  const uint16 = (at: number) => bytes[at] + 256 * bytes[at + 1];
  const width = uint16(6), height = uint16(8);
  if (!width || !height || width > 480 || height > 480) throw gifError();
  const paletteSize = (flags: number) => flags & 0x80 ? 3 * 2 ** (1 + (flags & 7)) : 0;
  let offset = 13 + paletteSize(bytes[10]);
  let frames = 0;
  const kept = [bytes.subarray(0, offset)];
  while (offset < bytes.length) {
    const start = offset++;
    const marker = bytes[start];
    if (marker === 0x3b) {
      if (offset !== bytes.length || frames < 2) throw gifError();
      kept.push(bytes.subarray(start));
      const pieces: string[] = [];
      for (const section of kept) {
        for (let index = 0; index < section.length; index += 8192) {
          pieces.push(String.fromCharCode(...section.subarray(index, index + 8192)));
        }
      }
      return { gif: btoa(pieces.join("")), width, height, frames };
    }
    if (marker === 0x21) {
      const label = bytes[offset++];
      const payloadStart = offset;
      offset = segmentsEnd(bytes, offset);
      const loop = label === 0xff && bytes[payloadStart] === 11 &&
        String.fromCharCode(...bytes.subarray(payloadStart + 1, payloadStart + 12)) === "NETSCAPE2.0";
      if (label === 0xf9) {
        if (offset - payloadStart !== 6 || bytes[payloadStart] !== 4) throw gifError();
        kept.push(bytes.subarray(start, offset));
      } else if (loop && offset - payloadStart === 17 && bytes[payloadStart + 12] === 3) {
        kept.push(bytes.subarray(start, offset));
      }
      continue;
    }
    if (marker !== 0x2c || offset + 10 > bytes.length) throw gifError();
    const left = uint16(offset), top = uint16(offset + 2);
    const frameWidth = uint16(offset + 4), frameHeight = uint16(offset + 6);
    if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) throw gifError();
    frames += 1;
    if (frames > 90 || frames * width * height > 9_000_000) throw gifError();
    offset += 9 + paletteSize(bytes[offset + 8]);
    const codeSize = bytes[offset++];
    if (codeSize < 2 || codeSize > 8 || !bytes[offset]) throw gifError();
    offset = segmentsEnd(bytes, offset);
    kept.push(bytes.subarray(start, offset));
  }
  throw gifError();
}

export async function readPersonalDemo(db: D1Database, owner: string, name: string) {
  return db.prepare("SELECT gif FROM exercise_demonstrations WHERE owner = ? AND exercise_key = ?")
    .bind(owner, nameKey(name)).first<{ gif: string }>();
}

export async function savePersonalDemo(db: D1Database, owner: string, givenName: string, image: string) {
  const name = demoName(givenName);
  const key = nameKey(name);
  if (!key || name.length > 100) throw new HttpError(400, "请提供对应动作的名称。");
  const { gif, ...dimensions } = cleanGif(image);
  const { results } = await db.prepare("SELECT id FROM personal_library WHERE owner = ? AND kind = 'exercise'")
    .bind(owner).all<{ id: string }>();
  const existing = results.some(({ id }) => nameKey(id) === key);
  const write = db.prepare("INSERT INTO exercise_demonstrations(owner, exercise_key, gif) VALUES (?, ?, ?) " +
    "ON CONFLICT(owner, exercise_key) DO UPDATE SET gif = excluded.gif WHERE gif <> excluded.gif")
    .bind(owner, key, gif);
  if (existing) await write.run();
  else await db.batch([write, db.prepare("INSERT INTO personal_library(owner, kind, id, day, payload, updated) " +
    "VALUES (?, 'exercise', ?, NULL, ?, ?) ON CONFLICT(owner, kind, id) DO NOTHING")
    .bind(owner, name, JSON.stringify({ kind: "exercise", item: blankProfile(name) }), new Date().toISOString())]);
  return { name, ...dimensions };
}

export async function removePersonalDemo(db: D1Database, owner: string, name: string) {
  await db.prepare("DELETE FROM exercise_demonstrations WHERE owner = ? AND exercise_key = ?").bind(owner, nameKey(name)).run();
  return { name };
}
