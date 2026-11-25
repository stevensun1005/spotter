import { dateSchema, offsetDate } from "@/shared/dates";
import { maxFoodGrams } from "./foods";
import type { ProteinProduct } from "@/features/training/protein";
import { milkFor } from "@/features/ai-coach/protein-photo-workflow";

const quantities: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 };
const amount = "(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十半])";
const cups = new RegExp(amount + "\\s*杯", "u");
const sharedCups = new RegExp("(?:每次|每天|各|都)(?:都|各)?\\s*(?:喝了?)?\\s*" + amount + "\\s*杯", "u");
const scoops = new RegExp(amount + "\\s*勺", "u");
const grams = new RegExp(amount + "\\s*(?:克|g)(?!(?:[a-z]|\\s*(?:的)?(?:牛奶|牛乳|水)))", "iu");
const milliliters = new RegExp(amount + "\\s*(?:m\\s*l|毫升)", "iu");
const relativeDay = /前天|昨天|昨日|今天|今日|\d{4}-\d{2}-\d{2}/gu;
const unsupportedDay = /昨晚|前晚|前几天|上周|上月|明天|后天|\d{1,2}\s*[月日号]/u;
const noLogging = /[?？]|(?:要不要|是否|怎么样|怎么喝|几杯|怎么算|多少|可以吗|好吗|吗$|不想喝|没喝|不喝|别记|不要记|不用记|已经记|喝过了吗)/u;
const nameKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function isSavedProteinCommand(message: string) {
  const note = message.normalize("NFKC").trim().replace(/[。.！!]$/u, "");
  return !noLogging.test(note) && !/(?:仓库|入库)/u.test(note) &&
    /(?:喝(?:了|完了)|饮用(?:了)?|(?:帮我|给我)?(?:记|加|录)(?:录|一下|入)?)/u.test(note) &&
    /蛋白粉|乳清|\bwhey\b/i.test(note);
}

export function selectSavedProtein(products: readonly ProteinProduct[], text: string, selected?: string) {
  if (selected) return products.find(({ id }) => id === selected);
  const note = nameKey(text);
  const exact = products.filter(({ name }) => note.includes(nameKey(name)))
    .sort((left, right) => nameKey(right.name).length - nameKey(left.name).length);
  if (exact[0] && (!exact[1] || nameKey(exact[0].name).length > nameKey(exact[1].name).length)) return exact[0];
  if (!exact.length && products.length === 1) return products[0];
}

type Serving = { day: string; cups: number };
type Recipe = { servings: Serving[]; powderGrams: number; liquidMl: number; mixer: ProteinProduct["mixer"]; estimated: boolean };
const numeric = (value?: string) => value === undefined ? undefined : quantities[value] ?? Number(value);

export function interpretSavedProtein(text: string, today: string, product: ProteinProduct): Recipe | string {
  const note = text.normalize("NFKC");
  const matches = [...note.matchAll(relativeDay)];
  const remaining = note.replace(relativeDay, "");
  if (unsupportedDay.test(remaining)) return "请告诉我喝蛋白粉的日期，例如「昨天」或「2026-11-23」。";
  const byDay = new Map<string, number>();
  const defaultCups = numeric(remaining.match(matches.length > 1 ? sharedCups : cups)?.[1]) ?? 1;
  matches.forEach((match, index) => {
    const label = match[0];
    const day = label === "前天" ? offsetDate(today, -2)
      : label === "昨天" || label === "昨日" ? offsetDate(today, -1)
      : label === "今天" || label === "今日" ? today : label;
    const clause = note.slice((match.index ?? 0) + label.length, matches[index + 1]?.index);
    byDay.set(day, numeric(clause.match(cups)?.[1]) ?? defaultCups);
  });
  if (!matches.length) byDay.set(today, defaultCups);
  const servings = Array.from(byDay, ([day, cups]) => ({ day, cups }));
  if (servings.length > 3 || servings.some(({ day, cups }) => !dateSchema.safeParse(day).success || day > today || cups <= 0 || cups > 10)) {
    return "请核对日期和杯数。一次可记三个已过去的日期，每天最多十杯。";
  }
  const overrideGrams = numeric(note.match(grams)?.[1]);
  const powderGrams = overrideGrams ?? product.scoopGrams * (numeric(note.match(scoops)?.[1]) ?? 1);
  const liquidMl = numeric(note.match(milliliters)?.[1]) ?? product.cupMl;
  const water = /(?:用|加|兑|冲)(?:\s*\d+(?:\.\d+)?\s*(?:m\s*l|毫升)\s*)?(?:清|纯)?水|(?:清|纯)?水(?:冲|泡)/iu.test(note);
  const milkFat = note.match(/(\d+(?:\.\d+)?)\s*%\s*(?:牛奶|牛乳)|(?:牛奶|牛乳)\s*(\d+(?:\.\d+)?)\s*%/u);
  const specifiedFat = /全脂(?:奶|牛奶|牛乳)/u.test(note) ? 3.25 : milkFat ? Number(milkFat[1] ?? milkFat[2]) : undefined;
  const namedMilk = /牛奶|牛乳/u.test(note);
  const mixer = water ? undefined : specifiedFat !== undefined ? milkFor(specifiedFat) : product.mixer;
  if (!water && (specifiedFat !== undefined && !mixer ||
      namedMilk && (!mixer || !/牛奶|牛乳|^milk\b/iu.test(mixer.name)))) {
    return "你用的是哪种牛奶？我可以按 2% 或全脂牛奶记录。";
  }
  if ([powderGrams, liquidMl].some((value) => !Number.isFinite(value) || value <= 0) || powderGrams > 250 || liquidMl > 2000 ||
      servings.some(({ cups }) => (powderGrams + liquidMl) * cups > maxFoodGrams)) return "请核对这次的粉量、液体量和杯数。";
  return { servings, powderGrams, liquidMl, mixer, estimated: Boolean(product.powderEstimated || product.scoopEstimated && overrideGrams === undefined) };
}
