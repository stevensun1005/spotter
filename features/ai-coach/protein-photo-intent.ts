import { dateSchema, offsetDate } from "@/shared/dates";

type Serving = { date: string; cups?: number };

export type ProteinPhotoIntent = {
  warehouse: boolean;
  logRequested: boolean;
  servings: Serving[];
  scoopsPerCup?: number;
  scoopGrams?: number;
  scoopGramsEstimated: boolean;
  nutritionEstimated: boolean;
  milkMl?: number;
  milkFatPercent?: number;
};

const amount = "(\\d+(?:\\.\\d+)?|半|[一二两三四五六七八九十])";
const numbers: Record<string, number> = { 半: 0.5, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const scoops = new RegExp(amount + "\\s*勺", "u");
const drinkingCups = new RegExp("^\\s*(?:的)?\\s*(?:各|都)?\\s*(?:喝了?|饮用了?)?\\s*(?:就|只)?\\s*" + amount + "\\s*杯", "u");
const commonCups = new RegExp("(?:每次|每一天|两天|各|都)(?:都|就|只)?\\s*(?:喝了?|饮用了?|记为|记)?\\s*" + amount + "\\s*杯", "u");
const warehouseAction = /(?:添加|加入|加|存放|保存|保留|存|放|留|记录|记|录入|补录|收录|录|写入)(?:\s*(?:到|至|进|入|在))?\s*(?:(?:我的|自己的)\s*)?(?:蛋白粉\s*)?仓库(?:\s*[里中内])?|(?:添加|保存|收录|录)?\s*入库/gu;
const cancelsWarehouse = /(?:不需要|不想|不要|不用|不必|没有|没|未|别|取消|不)\s*(?:先|再|帮我)?\s*(?:把\s*(?:这(?:[一1]?[个款桶种])?(?:\s*蛋白粉)?|它|蛋白粉)\s*)?$/u;
const warehouseOnly = /(?:只|仅)(?:要|先)?\s*(?:把\s*(?:这(?:[一1]?[个款桶种])?(?:\s*蛋白粉)?|它|蛋白粉)\s*)?$/u;
const datedWords = /前天|昨天|昨日|今天|今日|\d{4}-\d{2}-\d{2}/gu;
const otherDate = /前几天|这几天|最近|上周|这周|下周|上星期|下星期|每天|每日|明天|后天|上个月|这个月|\d{1,2}\s*[月日号]/u;
const negativeAction = /^\s*(?:(?:不|不要|不用|不必|别|取消)\s*(?:记|存|加|录|保存)|(?:不要|不用)[，。!?！、]|(?:不要|不用)$)/u;
const confirmEstimate = /(?:^|[，,。；;\n])\s*(?:允许|可以|请|那就|就|先)?\s*(?:按(?:通用|常见)(?:的)?(?:营养(?:值)?|数据)?\s*(?:估算?|记|保存)|按估算\s*(?:记|录|保存))\s*(?:$|[，,。！!；;\n])/u;

function number(text: string | undefined, min: number, max: number) {
  if (!text) return;
  const value = numbers[text] ?? Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

function requestedDate(word: string, today: string) {
  if (word === "今天" || word === "今日") return today;
  if (word === "昨天" || word === "昨日") return offsetDate(today, -1);
  if (word === "前天") return offsetDate(today, -2);
  return dateSchema.safeParse(word).success && word <= today ? word : undefined;
}

function resolvedServings(text: string, today: string, previous: Serving[], logRequested: boolean) {
  if (!logRequested) return [];
  const mentions = [...text.matchAll(datedWords)];
  const shared = number(text.match(commonCups)?.[1], 0.1, 10);
  const onlyMentioned = mentions.length > 0 && /(?:只|仅)(?:要)?(?:记|加|补|录)/u.test(text);
  const byDate = new Map((onlyMentioned ? [] : previous).map((entry) => [entry.date, entry.cups]));
  if (!mentions.length && !previous.length && !otherDate.test(text)) {
    byDate.set(today, number(text.match(drinkingCups)?.[1], 0.1, 10) ?? shared);
  }
  mentions.forEach((match, index) => {
    const date = requestedDate(match[0], today);
    if (!date) return;
    const end = match.index + match[0].length;
    const after = text.slice(end, mentions[index + 1]?.index);
    const before = text.slice(mentions[index - 1]?.index ?? 0, match.index);
    if (negativeAction.test(after.slice(0, 12)) || /(?:不要|不用|不必|别|取消)(?:补)?(?:记(?:录)?|录入)?\s*$/u.test(before)) {
      byDate.delete(date);
      return;
    }
    const cups = number(after.match(drinkingCups)?.[1], 0.1, 10) ?? byDate.get(date) ?? shared;
    byDate.set(date, cups);
  });
  return [...byDate].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cups]) => cups === undefined && shared === undefined ? { date } : { date, cups: cups ?? shared });
}

export function asksProteinWarehouseStatus(text: string): boolean {
  const note = text.normalize("NFKC").trim();
  if (!/(?:蛋白粉\s*)?仓库|入库/u.test(note)) return false;
  if (/^(?:(?:请|帮我|我想|我要|能不能|可以)\s*)*(?:打开|看看|看一下|查一下|查看|查查|列出)(?:一下)?\s*(?:我的\s*)?(?:蛋白粉\s*)?仓库/u.test(note)) return true;
  const status = /了吗|了没|已(?:经|保存|添加|加|入库|录入|存)|(?:没(?:有)?|未)(?:加|存|录|写|入库)|有没有|有没|是否|是不是|成功|加好|存好|(?:仓库|里面|那里)(?:[里中])?\s*(?:有|都有哪些|存了|记了)|在(?:仓库|里面|里)(?:吗|么)/u;
  return status.test(note) && /[?]|(?:吗|么|没|没有|哪些|什么|几款)[。！!]*$|是否|是不是|有没有|有没/u.test(note);
}

export function confirmsSameProteinProduct(text: string): boolean {
  const note = text.normalize("NFKC").trim();
  return /^(?:(?:对|没错)[，,、。 ]*)?(?:(?:这(?:就是|是)|(?:我)?确认这?(?:就是|是)?|就是|是)\s*(?:这(?:一)?款|同一款|同款|这一个|这个产品|同一个产品)|同一款|同款)[。！!]*$/u.test(note);
}

export function parseProteinPhotoIntent(text: string, localDate: string, previous?: ProteinPhotoIntent): ProteinPhotoIntent | undefined {
  const note = text.normalize("NFKC").trim();
  if (asksProteinWarehouseStatus(note)) return;
  const warehouseActions = [...note.matchAll(warehouseAction)];
  const lastWarehouseAction = warehouseActions.at(-1);
  const diaryText = note.replace(warehouseAction, "");
  const logsDrinks = /(?:记(?:录|一下|到|入|上|下来)|补(?:记|录|上)|录入|写入|录进去)/u.test(diaryText) ||
    Boolean(diaryText.match(datedWords) && (/(?:喝|饮用)/u.test(diaryText) || diaryText.match(drinkingCups)));
  if (!previous && !lastWarehouseAction && (!/(?:蛋白粉|乳清|whey)/iu.test(note) || !logsDrinks)) return;

  const beforeWarehouse = lastWarehouseAction ? note.slice(0, lastWarehouseAction.index) : "";
  const warehouse = lastWarehouseAction ? !cancelsWarehouse.test(beforeWarehouse) : Boolean(previous?.warehouse);
  const diaryCancelled = /(?:^|[，,。；;])\s*(?:那就|先)?(?:不要|不用|不必|别|取消)\s*(?:补)?(?:记录?|录入)(?:了|饮食|日记|这(?:次|两天))?\s*(?:$|[，,。！!；;])/u.test(diaryText);
  const onlyWarehouse = warehouse && warehouseOnly.test(beforeWarehouse);
  const logRequested = !diaryCancelled && !onlyWarehouse && (logsDrinks || Boolean(previous?.logRequested));
  const amountByLabel = note.match(/(?:每|一|1)\s*勺(?:粉|蛋白粉)?\s*(?:大约|大概|约|是|为|重|=)?\s*(\d+(?:\.\d+)?)\s*(?:g|克)/iu)?.[1];
  const allowEstimate = /[?？]|(?:吗|可以不)[。！!]?$/u.test(note) ? undefined
    : note.match(/(?<!别)(?<!不)按\s*(\d+(?:\.\d+)?)\s*(?:g|克)(?:\s*(?:\/|每)?\s*勺)?\s*(?:估算?|算)/iu)?.[1];
  const bareGrams = previous && previous.scoopGrams === undefined
    ? note.match(/^(\d+(?:\.\d+)?)\s*(?:g|克)(?:\/勺)?[。.!！]?$/iu)?.[1] : undefined;
  const scoopGrams = number(amountByLabel ?? allowEstimate ?? bareGrams, 0.1, 250);
  const milkMl = number((note.match(/(\d+(?:\.\d+)?)\s*(?:m\s*l|毫升)\s*(?:\d+(?:\.\d+)?\s*%\s*)?(?:的)?\s*(?:牛奶|牛乳)/iu) ??
    note.match(/(?:牛奶|牛乳)\s*(?:为|是|用|加)?\s*(\d+(?:\.\d+)?)\s*(?:m\s*l|毫升)/iu) ??
    (previous && note.match(/^(\d+(?:\.\d+)?)\s*(?:m\s*l|毫升)[。.!！]?$/iu)))?.[1], 1, 2000);
  const milkFatPercent = number((note.match(/(\d+(?:\.\d+)?)\s*%\s*(?:的)?\s*(?:牛奶|牛乳)/u) ??
    note.match(/(?:牛奶|牛乳)\s*(\d+(?:\.\d+)?)\s*%/u) ??
    (previous && note.match(/^(\d+(?:\.\d+)?)\s*%[。.!！]?$/u)))?.[1], 0, 100) ??
    (/全脂(?:牛奶|牛乳|奶)|^全脂[。.!！]?$/u.test(note) ? 3.25 : undefined);
  const nutritionEstimated = /(?:别|不要|不用)\s*(?:先)?按(?:通用|常见|估算)/u.test(note) ? false
    : confirmEstimate.test(note) || Boolean(previous?.nutritionEstimated);

  return {
    warehouse, logRequested, servings: resolvedServings(diaryText, localDate, previous?.servings ?? [], logRequested),
    scoopsPerCup: number(note.match(scoops)?.[1], 0.1, 10) ?? previous?.scoopsPerCup,
    scoopGrams: scoopGrams ?? previous?.scoopGrams,
    scoopGramsEstimated: scoopGrams !== undefined ? Boolean(allowEstimate && !amountByLabel) : Boolean(previous?.scoopGramsEstimated),
    nutritionEstimated, milkMl: milkMl ?? previous?.milkMl, milkFatPercent: milkFatPercent ?? previous?.milkFatPercent,
  };
}

export function proteinPhotoQuestion(intent: ProteinPhotoIntent): string | undefined {
  if (intent.scoopGrams === undefined) return "内置的一勺是多少克？如果查不到，你也可以明确说「按 30 克估」。";
  if (intent.scoopsPerCup === undefined) return "一杯放几勺蛋白粉？";
  if (intent.milkMl === undefined) return "一杯用多少毫升牛奶？";
  if (intent.logRequested && !intent.servings.length) return "要记到哪一天？可以说「昨天和今天」。";
  if (intent.servings.some(({ cups }) => cups === undefined)) return "这几天各喝了几杯？如果每次一杯，说「每次喝一杯」就可以。";
}
