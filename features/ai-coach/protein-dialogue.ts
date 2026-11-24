type Product = Readonly<{ id: string; name: string }>;

type Drink = {
  kind: "drink";
  selector?: string;
  date?: string;
  dayOffset?: number;
  servings: number;
  repeat: boolean;
  powderGrams?: number;
  mixerName?: string;
  mixerMl?: number;
};

type Clarification = { kind: "clarify"; message: string };
type ProductMatch = { kind: "selected"; id: string } | { kind: "ambiguous" } | { kind: "unmatched" };

const protein = /乳清蛋白粉|蛋白粉|乳清蛋白|乳清|\bwhey\b/iu;
const relativeDays: Readonly<Record<string, number>> = {
  前天: -2, 昨天: -1, 昨日: -1, 昨晚: -1, 今天: 0, 今日: 0, 今早: 0, 今晚: 0,
};
const day = /前天|昨天|昨日|昨晚|今天|今日|今早|今晚|\d{4}-\d{1,2}-\d{1,2}/u;
const otherDay = /前几天|上(?:周|星期|个月)|这(?:周|几天)|每(?:日|天)|最近|明天|后天|\d{1,2}\s*[月日号]/u;
const drink = /^((?:(?:我|帮我|请|前天|昨天|昨日|昨晚|今天|今日|今早|今晚|\d{4}-\d{1,2}-\d{1,2}|刚(?:才)?|已经|又|再|也|训练后|练完|顺便|想)\s*)*)(?:喝(?:完|掉)?了|喝的是|(?:补)?记(?:录|一下|上)?)\s*(.+)$/iu;
const cupCount = /^(第)?\s*(\d+(?:\.\d+)?|[一二两三四五六七八九十]|半)\s*杯\s*/u;
const numbers: Readonly<Record<string, number>> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 };
const powderQuantity = /^(?:粉量\s*(?:是|为|用|=)?\s*|(?:用|加了?|放了?)\s*)?(\d+(?:\.\d+)?)\s*(?:克|g)(?:\s*(?:的)?\s*(?:粉|蛋白粉))?$/iu;
const mixer = /^(?:用|加了?|兑了?|混了?|拿)\s*(?:(\d+(?:\.\d+)?)\s*(?:毫升|ml)\s*(?:的)?\s*)?(.+?)\s*(?:冲(?:泡)?(?:的|了)?|调的|兑的)?$/iu;
const knownMixer = /^(?:(?:\d+(?:\.\d+)?\s*%\s*(?:的)?\s*|全脂|低脂|脱脂)?(?:牛奶|牛乳)|水|白水|清水|温水|豆浆|豆奶|燕麦奶|杏仁奶|椰奶|羊奶)$/u;

function normalizeNote(text: string): string {
  return text.normalize("NFKC").trim().replace(/[。.!！]+$/u, "").trim();
}

function normalizedName(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(protein, "").replace(/[\p{P}\s]/gu, "").replace(/的$/u, "");
}

function validDate(text: string): string | undefined {
  const date = text.split("-").map((part, index) => index ? part.padStart(2, "0") : part).join("-");
  const parsed = new Date(date + "T00:00:00Z");
  if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return date;
}

export function proteinDrinkIntent(text: string): Drink | Clarification | undefined {
  const note = normalizeNote(text);
  if (!protein.test(note) || /\?|[吗么呢]$|怎么|为什么|多少|应该|是不是|有没有|要不要|如果|假如|没喝|未喝|不喝|还没|(?:先不|别|不需要|不用|暂不|不要)(?:用|再)?(?:记|录|保存)|记过|已经(?:记|录|保存)|入库|仓库\s*[里中内]?\s*(?:有|是)/u.test(note)) return;
  const [statement, ...recipe] = note.split(/\s*[,，。;；\n]+\s*/u);
  const match = statement.match(drink);
  if (!match || !protein.test(match[2])) {
    if (otherDay.test(statement) && /^我?\s*(?:喝了|(?:补)?记)/u.test(statement.replace(otherDay, ""))) {
      return { kind: "clarify", message: "这杯要记在哪一天？告诉我具体日期。" };
    }
    return;
  }
  const [, prefix, description] = match;
  const dateToken = prefix.match(day)?.[0];
  const date = dateToken?.includes("-") ? validDate(dateToken) : undefined;
  if (dateToken?.includes("-") && !date || otherDay.test(statement) || day.test(prefix.replace(day, "")) ||
    [description, ...recipe].some((part) => day.test(part) || otherDay.test(part))) {
    return { kind: "clarify", message: "这杯要记在哪一天？告诉我具体日期。" };
  }

  let [body, inlineRecipe] = description.split(/(?<=蛋白粉|乳清蛋白|乳清|whey)\s*(?=用|加了|粉量|兑了)/iu);
  const count = body.match(cupCount);
  const servings = count && !count[1] ? numbers[count[2]] ?? Number(count[2]) : 1;
  if (servings < 0.1 || servings > 10 || /(?:\d|[一二两三四五六七八九十半几])\s*(?:[杯勺克]|毫升|ml\b|g\b)/iu.test(body.slice(count?.[0].length ?? 0))) {
    return { kind: "clarify", message: "这次喝了几杯？如果粉量或冲泡方式有变化，也请告诉我每杯用了什么、用了多少。" };
  }
  body = body.slice(count?.[0].length ?? 0).trim();
  const selector = body.replace(protein, "").trim().replace(/^[\s的:：()（）「」“”]+|[\s的:：()（）「」“”]+$/gu, "")
    .replace(/^(?:(?:我?的|仓库里(?:的)?|默认(?:的)?|[那这]一?[款杯](?:的)?|同款(?:的)?|了|啦|哦)[ ]*)+$/u, "");
  if (/和|以及|然后|不过|打算|想要|营养|统计|查询|加餐|牛奶冲|配方|^了$|^没/u.test(selector)) return;

  const result: Drink = {
    kind: "drink", servings,
    repeat: Boolean(count?.[1]) || /又|再/u.test(prefix),
    ...(selector ? { selector } : {}),
    ...(date ? { date } : dateToken ? { dayOffset: relativeDays[dateToken] } : {}),
  };

  for (const part of [inlineRecipe, ...recipe].filter(Boolean)) {
    if (/^(?:(?:请|帮我|顺便)\s*)*(?:记录?|录入)(?:一下|上)?$/u.test(part)) continue;
    const powder = part.match(powderQuantity);
    if (powder && result.powderGrams === undefined && Number(powder[1]) >= 0.1 && Number(powder[1]) <= 250) {
      result.powderGrams = Number(powder[1]);
      continue;
    }
    const liquid = part.match(mixer);
    if (liquid && result.mixerName === undefined && knownMixer.test(liquid[2].trim()) &&
      (liquid[1] === undefined || Number(liquid[1]) >= 1 && Number(liquid[1]) <= 2000)) {
      result.mixerName = liquid[2].trim();
      if (liquid[1]) result.mixerMl = Number(liquid[1]);
      continue;
    }
    return { kind: "clarify", message: "这次配方和仓库有变化吗？请告诉我每杯的粉量（克）及冲泡液体和用量（毫升）。" };
  }
  return result;
}

export function resolveProteinProduct(products: readonly Product[], selector?: string): ProductMatch {
  if (selector === undefined) {
    if (products.length === 1) return { kind: "selected", id: products[0].id };
    return { kind: products.length ? "ambiguous" : "unmatched" };
  }
  const query = normalizedName(selector);
  const names = products.map((product) => ({ id: product.id, name: normalizedName(product.name) }));
  const exact = names.filter(({ name }) => query && name === query);
  const matches = exact.length || query.length < 2 ? exact : names.filter(({ name }) => name.includes(query));
  if (matches.length === 1) return { kind: "selected", id: matches[0].id };
  return { kind: matches.length ? "ambiguous" : "unmatched" };
}

export function proteinDrinkSelection(text: string, products: readonly Product[]): ProductMatch | { kind: "cancel" } | undefined {
  const note = normalizeNote(text);
  if (/^(?:(?:那就)?(?:取消|算了|不用|不用记(?:了)?|别记(?:了)?|不记(?:了)?))$/u.test(note)) return { kind: "cancel" };
  const ordinal = note.match(/^(?:选|就是|是)?\s*(?:第\s*)?(\d+|[一二两三四五六七八九十])\s*(?:款|个|号)?$/u);
  if (ordinal) {
    const selected = products[(numbers[ordinal[1]] ?? Number(ordinal[1])) - 1];
    return selected ? { kind: "selected", id: selected.id } : { kind: "unmatched" };
  }
  const choicePrefix = /^(?:我喝的是|我喝的|喝的是|我选|就选|就是|选|是)\s*/u;
  if (/[?？吗么呢]|怎么|什么|为什么|我想|给我|帮我|看下/u.test(note) || !choicePrefix.test(note) && proteinDrinkIntent(note)) return;
  const name = note.replace(choicePrefix, "").replace(/\s*(?:那|这)一?款$/u, "").trim();
  const match = resolveProteinProduct(products, name);
  if (match.kind !== "unmatched" || /^(?:我喝的是|我喝的|喝的是|我选|就选|就是|选)/u.test(note)) return match;
}
