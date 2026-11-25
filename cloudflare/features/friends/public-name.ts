export function searchName(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

export function publicName(value: string) {
  const name = value.trim().slice(0, 80);
  return name && !searchName(name).includes("@") ? name : "训练好友";
}
