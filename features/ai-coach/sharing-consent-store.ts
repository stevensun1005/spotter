const sharingKey = (owner: string) => `spotter:anthropic-sharing:v1:${owner}`;

export function allowsAnthropicSharing(storage: Pick<Storage, "getItem">, owner: string) {
  return Boolean(owner && storage.getItem(sharingKey(owner)) === "allowed");
}

export function allowAnthropicSharing(storage: Pick<Storage, "setItem">, owner: string) {
  if (owner) storage.setItem(sharingKey(owner), "allowed");
}
