import { measurements } from "../body/measurements";
import { dateSchema } from "../../shared/dates";

type WeightDay = { date?: string; dayOffset?: number };
export type PendingWeight = WeightDay & { dateRequired?: boolean; assumeKg?: boolean };
export type WeightDialogueResult =
  | { kind: "pass"; clearPending: boolean }
  | ({ kind: "ask"; message: string } & PendingWeight)
  | { kind: "cancel"; message: string }
  | ({ kind: "record"; kg: number } & WeightDay);

const weightSubject = /体重|晨重|\b(?:body[ -]?)?weight\b/u;
const chineseWrite = /(?:^|[，,。；;\n:：]\s*)(?:(?:教练|请问|请|麻烦你?|能不能|可不可以|可以|能|想|要|我想|我要|我需要|帮我|给我|替我|为我|帮忙)\s*)*(?:记(?!得|着|住)|登记|录入|存(?:下|一下)|保存|补记|写(?:下|入)|加[入上]|体重打卡|晨重打卡)|(?:帮我|给我|替我|为我|请把|麻烦把)[^，,。；;\n]{0,60}(?:记(?!得|着|住)|登记|录入|保存|补记|写(?:下|入))/u;
const englishWrite = /(?:^|[,.!;\n]\s*)(?:(?:please|can you|could you|would you|help me|i want you to|i need you to|i'd like you to)\s+)*(?:log|record|save|add|track)\b/u;
const cancelRequest = /(?:(?:不要|别|暂不|先不|不用|不必|不想再?)\s*(?:记|录|存|写入)|取消\s*(?:记录|记|录|保存|体重)|\b(?:don't|do not|stop|never)\s+(?:log|record|save|track)\b)/u;
const shortCancel = /^(?:取消|算了|先不用了?|不用了?|先这样|放弃|取消吧|不记了?|不录了?|cancel|never mind|nevermind)[\s。!！.]*$/u;
const otherPerson = /(?:(?:他|她)的?(?:体重|晨重|称重)|(?:女朋友|男朋友|老公|老婆|媳妇|伴侣|朋友|搭子|同事|客户|儿子|女儿|孩子|爸爸?|妈妈?|父亲|母亲)的?(?:体重|晨重|称重)|(?:帮|给|替|为)(?:他|她|我?(?:女朋友|男朋友|老公|老婆|媳妇|伴侣|朋友|搭子|同事|客户|儿子|女儿|孩子|爸爸?|妈妈?|父亲|母亲))\s*(?:记|录|登记|称)|\b(?:his|her|their|someone else's|(?:my )?(?:partner|wife|husband|friend|parent|child)'s)\s+(?:body )?weight\b|\b(?!(?:today|yesterday|morning)'s\b)[a-z][a-z'-]{1,30}'s (?:body )?weight\b|(?:帮|替)(?!我|自己|本人|忙)[\p{L}]{1,8}(?:记|录入|登记)\s*(?:体重|晨重))/u;
const methodQuestion = /(?:怎么|如何|怎样|在哪[儿里]?)\s*(?:才能?)?\s*(?:记|录|存|看)|\b(?:how|where|why|whether)\b[^?。]*\b(?:log|record|track|save)\b|为什么[^?。]*(?:记录|记)体重/u;
const advice = /(?:目标|理想|想(?:减|降|瘦|增|达到)|(?:正常|合适|健康)吗|算不算|给(?:点|些)?.?建议|如何|怎么|多少才|制定|减肥计划|体重建议|\b(?:target|goal|ideal|advice|recommend|should|healthy|bmi)\b)/u;
const uncertainty = /(?:大概|大约|差不多|也许|可能是|不确定|以上|以下|左右|约\s*\d|\d+(?:\.\d+)?\s*(?:到|至|或者?|[-~～–—])\s*\d|\b(?:roughly|approximately|about|around|maybe|or)\b)/u;
const startsWithAmount = /^(?:(?:是|大概|大约|约|可能是|我刚(?:称|测)的(?:是)?|i weigh|it's|[~≈])\s*)?[+-]?(?:\d|\.\d)/u;
const pounds = new Set(["磅", "lb", "lbs", "pound", "pounds"]);
const jin = new Set(["斤", "市斤"]);
const amountWithUnit = /(?<![\d.+\-])(?<!\d,)([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(公斤|千克|kg|kgs|kilogram|kilograms|磅|lbs?|pounds?|市斤|斤)(?![a-z])/gu;

const weightQuestion = "你称了多少公斤？可以直接回 80.5，用磅或斤时请标出单位。";
const dateQuestion = "这次是哪一天称的？请写明日期和体重，例如 2026-11-24 80.5 kg。";
const cancelled = "已取消这次体重记录。";

function weightDay(text: string, pending: PendingWeight): PendingWeight {
  const tokens = [...text.matchAll(/\b\d{4}-\d{1,2}-\d{1,2}\b/gu)].map(([value]) => value);
  if (tokens.length === 1 && dateSchema.safeParse(tokens[0]).success) return { date: tokens[0] };
  if (tokens.length) return { dateRequired: true };
  if (/(?:前天|\bday before yesterday\b)/u.test(text)) return { dayOffset: -2 };
  if (/(?:昨天|昨日|昨晚|昨早|\byesterday\b)/u.test(text)) return { dayOffset: -1 };
  if (/(?:今天|今日|今早|今晚|\btoday\b|\bthis morning\b)/u.test(text)) return { dayOffset: 0 };
  if (/(?:明天|明早|后天|上次|(?:上|下|这|本)(?:周|星期|月|年)|(?:周|星期)[一二三四五六日天]|\d{1,2}\s*月\s*\d{1,2}|\b(?:\d{4}[/.]\d{1,2}[/.]\d{1,2}|\d{1,2}\/\d{1,2})(?=\s|$|的|体重)|\b(?:tomorrow|last (?:time|week|month)|next (?:week|month))\b)/u.test(text)) {
    return { dateRequired: true };
  }
  return pending;
}

export function weightDialogue(message: string, pending: boolean | PendingWeight = false): WeightDialogueResult {
  const text = message.normalize("NFKC").toLowerCase().replace(/[’‘]/gu, "'").trim();
  const subject = weightSubject.test(text);
  const explicit = subject && (chineseWrite.test(text) || englishWrite.test(text));
  if ((pending && shortCancel.test(text)) || ((pending || subject) && cancelRequest.test(text))) {
    return { kind: "cancel", message: cancelled };
  }
  if ((pending || subject) && otherPerson.test(text) && /记|录入|登记|\b(?:log|record|save)\b/u.test(text)) {
    return { kind: "cancel", message: "这次只记录你本人的体重。" };
  }
  if ((!pending && !explicit) || methodQuestion.test(text)) return { kind: "pass", clearPending: Boolean(pending) };

  const context: PendingWeight = {};
  if (typeof pending === "object") {
    if (pending.date) context.date = pending.date;
    if (pending.dayOffset !== undefined) context.dayOffset = pending.dayOffset;
    if (pending.dateRequired) context.dateRequired = true;
  }
  const date = weightDay(text, context);
  if (otherPerson.test(text)) {
    return { kind: "cancel", message: "这次只记录你本人的体重。请在你自己的体重记录里填写确认过的数值。" };
  }
  if (advice.test(text)) {
    return explicit
      ? { kind: "ask", message: "请单独发你实测的体重和单位，再记录这次体重。", ...date }
      : { kind: "pass", clearPending: Boolean(pending) };
  }

  const reply = text.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b|前天|昨天|昨日|今日|今天|今早|今晚|昨早|昨晚|\b(?:day before yesterday|today|yesterday|this morning)\b/gu, "").trim();
  const amounts = [...reply.matchAll(amountWithUnit)];
  const bareKg = !amounts.length && typeof pending === "object" && pending.assumeKg
    ? reply.match(/^(?:是\s*)?([+-]?(?:\d+(?:\.\d+)?|\.\d+))[\s。!！]*$/u)?.[1] : undefined;
  const uncertain = uncertainty.test(reply);
  const weighed = /^(?:我(?:现在|刚才|今早|刚)?)?\s*(?:称(?:了|出来是|重是)|测(?:了|出来是))\s*[+-]?\d/u.test(reply);
  if (!explicit && !subject && !startsWithAmount.test(reply) && !weighed && (reply !== "" || date === context)) {
    return { kind: "pass", clearPending: Boolean(pending) };
  }
  if (date.dateRequired) return { kind: "ask", message: dateQuestion, dateRequired: true };
  if ((!bareKg && amounts.length !== 1) || uncertain) {
    if (amounts.length > 1 || uncertain) return { kind: "ask", message: "请选择一个确定的实测体重，并带上单位。", ...date };
    return { kind: "ask", message: weightQuestion, ...date, assumeKg: true };
  }

  const [, value, unit] = amounts[0] ?? ["", bareKg, "kg"];
  const kg = Number(value) * (pounds.has(unit) ? 0.45359237 : jin.has(unit) ? 0.5 : 1);
  const { min, max } = measurements.weight;
  if (!Number.isFinite(kg) || kg < min || kg > max) {
    return { kind: "ask", message: "请核对数值和单位，体重需要在 " + min + " 到 " + max + " kg 之间。", ...date };
  }
  return { kind: "record", kg: Math.round(kg * 100) / 100, ...date };
}
