import { matchingSummary, sampleCollection, sourceSummary, type TimeWindow } from "./model";

export function timeValue(value: string, zone = "") {
  const cleaned = value.trim();
  if (/^\d{10,13}$/.test(cleaned)) return cleaned.length === 10 ? Number(cleaned) * 1000 : Number(cleaned);
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!match) return NaN;
  const offset = (match[3] || zone.trim().replace(/^(?:UTC|GMT)$/i, "Z").replace(/^(?:UTC|GMT)(?=[+-])/i, "")).replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  // A timezone-free timestamp would silently use the importing device's zone.
  if (!/^(?:Z|[+-]\d{2}:\d{2})$/i.test(offset)) return NaN;
  return Date.parse(match[1] + "T" + match[2] + offset);
}

export function appleParser(window: TimeWindow) {
  const samples = sampleCollection(window);
  const sourceNames = new Set<string>();
  const decoder = new TextDecoder();
  let tail = "";
  return {
    feed(bytes: Uint8Array, final = false) {
      const input = tail + decoder.decode(bytes, { stream: !final });
      const lastTag = input.lastIndexOf("<");
      const partial = lastTag > input.lastIndexOf(">") && input.length - lastTag < 8192;
      tail = partial ? input.slice(lastTag) : "";
      const text = partial ? input.slice(0, lastTag) : input;
      for (const tag of text.matchAll(/<Record\b([^<>]*)>/g)) {
        if (!/\btype\s*=\s*["']HKQuantityTypeIdentifierHeartRate["']/.test(tag[1])) continue;
        const at = tag[1].match(/\bstartDate\s*=\s*["']([^"']+)["']/)?.[1];
        const rate = tag[1].match(/\bvalue\s*=\s*["']([^"']+)["']/)?.[1];
        if (at && rate) {
          const timestamp = timeValue(at);
          const bpm = Number(rate);
          samples.add(timestamp, bpm);
          if (timestamp >= window.from && timestamp <= window.to && bpm >= 1 && bpm <= 300) {
            const name = tag[1].match(/\bsourceName\s*=\s*(["'])(.*?)\1/)?.[2];
            if (name) sourceNames.add(xmlText(name));
          }
        }
      }
    },
    finish() {
      const result = samples.collect("apple");
      const sourceName = [...sourceNames].join(" / ").slice(0, 160).trim();
      return result && { ...result, ...(sourceName ? { sourceName } : {}) };
    },
  };
}

function xmlText(value: string) {
  const entities: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
  };
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => entities[entity] ?? entity).trim();
}

export function readTcx(text: string, window: TimeWindow) {
  const samples = sampleCollection(window);
  const field = (value: string, name: string) =>
    value.match(new RegExp("<(?:[\\w-]+:)?" + name + "\\b[^>]*>([^<]*)</(?:[\\w-]+:)?" + name + ">"))?.[1]?.trim();
  for (const [, trackpoint] of text.matchAll(/<(?:[\w-]+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Trackpoint>/g)) {
    const time = field(trackpoint, "Time");
    const heart = trackpoint.match(/<(?:[\w-]+:)?HeartRateBpm\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?HeartRateBpm>/)?.[1];
    const value = heart && field(heart, "Value");
    if (time && value) samples.add(timeValue(time), Number(value));
  }
  const result = samples.collect("tcx");
  const creator = text.match(/<(?:[\w-]+:)?Creator\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Creator>/)?.[1];
  const name = creator && field(creator, "Name");
  const sourceName = name && xmlText(name).slice(0, 160);
  return result && { ...result, ...(sourceName ? { sourceName } : {}) };
}

function* csvRows(text: string) {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (char === '"' && !field) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      if (row.length || field) yield [...row, field];
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV 有未闭合的引号。");
  if (row.length || field) yield [...row, field];
}

export function readCsv(text: string, window: TimeWindow) {
  const rows = csvRows(text.replace(/^\uFEFF/, ""));
  const header = rows.next().value?.map((key) => key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")) ?? [];
  const lookup = (...keys: string[]) => header.findIndex((name) => keys.includes(name));
  const from = header.findIndex((name) => /^(workout|activity)(start|starttime)/.test(name));
  const to = header.findIndex((name) => /^(workout|activity)(end|endtime)/.test(name));
  const average = lookup("averagehr", "averagehrbpm", "averageheartrate", "averageheartratebpm", "avghr", "avghrbpm");
  const maximum = lookup("maxhr", "maxhrbpm", "maxheartrate", "maxheartratebpm", "maximumheartrate", "maximumheartratebpm", "peakhrbpm");
  const zone = lookup("timezone", "workouttimezone", "cycletimezone", "activitytimezone", "timezoneoffset");
  if (from >= 0 && to >= 0 && (average >= 0 || maximum >= 0)) {
    const records = Array.from(rows, (row) =>
      sourceSummary("whoop", timeValue(row[from] ?? "", row[zone]), timeValue(row[to] ?? "", row[zone]), row[average], row[maximum]));
    return matchingSummary(window, records);
  }
  const time = lookup("time", "timestamp", "datetime", "date", "startdate");
  const heart = lookup("heartrate", "heartratebpm", "bpm", "hr", "hrbpm", "value");
  if (time < 0 || heart < 0) throw new Error("CSV 需要 time 与 bpm 列，或 WHOOP 的训练起止时间与心率摘要。");
  const samples = sampleCollection(window);
  for (const row of rows) samples.add(timeValue(row[time] ?? "", row[zone]), Number(row[heart]));
  return samples.collect("csv");
}
