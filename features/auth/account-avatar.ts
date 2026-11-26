import { z } from "zod";
import { HttpError } from "@/server/http";

export const avatarMaxBytes = 60_000;
const maxBase64Length = Math.ceil(avatarMaxBytes / 3) * 4;
export const accountAvatarUpdate = z.object({
  image: z.string().min(4).max(maxBase64Length).nullable(),
  expectedOwner: z.string().min(1).max(250),
}).strict();

const invalidImage = () => new HttpError(400, "请选择可以读取的头像照片。");

function sanitizedAvatar(image: string) {
  if (image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw invalidImage();
  let decoded: string;
  try { decoded = atob(image); }
  catch { throw invalidImage(); }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (bytes.length > avatarMaxBytes || bytes.length < 32 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw invalidImage();
  const clean = [0xff, 0xd8];
  let offset = 2;
  let foundFrame = false;
  let foundScan = false;
  let scanning = false;
  while (offset < bytes.length) {
    if (scanning) {
      if (bytes[offset] !== 0xff) {
        clean.push(bytes[offset++]);
        continue;
      }
      const next = bytes[offset + 1];
      if (next === 0 || (next >= 0xd0 && next <= 0xd7)) {
        clean.push(bytes[offset], next);
        offset += 2;
        continue;
      }
      scanning = false;
    }
    if (bytes[offset++] !== 0xff) throw invalidImage();
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!foundFrame || !foundScan || offset !== bytes.length) throw invalidImage();
      clean.push(0xff, 0xd9);
      return btoa(String.fromCharCode(...clean));
    }
    if (marker < 0xc0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || offset + 2 > bytes.length) {
      throw invalidImage();
    }
    const count = bytes[offset] * 256 + bytes[offset + 1];
    const end = offset + count;
    if (count < 2 || end > bytes.length) throw invalidImage();
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (![0xc0, 0xc2].includes(marker) || foundFrame || count < 11 || bytes[offset + 2] !== 8) throw invalidImage();
      const height = bytes[offset + 3] * 256 + bytes[offset + 4];
      const width = bytes[offset + 5] * 256 + bytes[offset + 6];
      if (width < 1 || height < 1 || width > 256 || height > 256) throw invalidImage();
      foundFrame = true;
    }
    if (marker === 0xda) {
      if (!foundFrame || count < 6) throw invalidImage();
      scanning = true;
      foundScan = true;
    }
    // Keep only the image sections. APP and COM markers can contain EXIF,
    // owner-provided comments, thumbnails, and other private metadata.
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) {
      clean.push(0xff, marker, ...bytes.subarray(offset, end));
    }
    offset = end;
  }
  throw invalidImage();
}

export async function readAccountAvatar(db: D1Database, owner: string) {
  const row = await db.prepare("SELECT image FROM spotter_account_avatars WHERE owner = ?")
    .bind(owner).first<{ image: string }>();
  return { image: row?.image ?? null };
}

export async function saveAccountAvatar(db: D1Database, owner: string, input: z.infer<typeof accountAvatarUpdate>) {
  if (input.expectedOwner !== owner) throw new HttpError(403, "当前登录账号已切换，请重新打开设置。");
  if (input.image === null) {
    await db.prepare("DELETE FROM spotter_account_avatars WHERE owner = ?").bind(owner).run();
    return { image: null };
  }
  const image = sanitizedAvatar(input.image);
  const saved = await db.prepare(
    "INSERT INTO spotter_account_avatars (owner, image) SELECT id, ? FROM spotter_access_accounts WHERE id = ? " +
    "ON CONFLICT(owner) DO UPDATE SET image = excluded.image"
  ).bind(image, owner).run();
  if (!saved.meta.changes) throw new HttpError(401, "请重新登录后更新头像。");
  return { image };
}
