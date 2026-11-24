export const tempoMaxLength = 80;
export const tempoNotationHint = "四拍依次为离心、转换停顿、向心、结束停顿。数字是秒，X 表示快速发力。";

type TempoMove = {
  name: string;
  tempo?: string;
  cue?: string;
  sourceName?: string;
  seconds?: number;
  reps?: number;
};
type TempoCatalogue = { type: string; en?: string; hold?: boolean; distance?: boolean };

const phasePattern = /^(?:\d{1,2}-){2}(?:\d{1,2}|X)-\d{1,2}$/;
const phaseCue = /(?:tempo|节奏|节拍)\s*[:：=]?\s*((?:[0-9]{1,2}\s*[-/／–]\s*){2}(?:[0-9]{1,2}|x)\s*[-/／–]\s*[0-9]{1,2}|[0-9]{2}[0-9x][0-9])(?![\d-])/i;

export function normalizeTempo(value: string) {
  const text = value.trim();
  const formatted = /^[0-9]{2}[0-9x][0-9]$/i.test(text)
    ? Array.from(text.toUpperCase()).join("-")
    : text.replace(/\s*[-/／–]\s*/g, "-").toUpperCase();
  return phasePattern.test(formatted) ? formatted : text;
}

export function tempoFromCue(text: string) {
  const match = phaseCue.exec(text);
  return match ? normalizeTempo(match[1]) : undefined;
}

function suggestedTempo(move: TempoMove, item?: TempoCatalogue, category?: string) {
  const name = [move.name, move.sourceName, item?.en].filter(Boolean).join(" ");
  const type = item?.type;
  if (/呼吸|breath/i.test(name)) return "自然吸气，缓慢呼气";
  if (/(?:慢走|快走|骑车|跑步|慢跑|跑步机|划船机|treadmill|elliptical|cycling)/i.test(name))
    return "保持均匀步频或踏频，按本次强度完成";
  if (type === "cardio") return "按本次强度，保持均匀节奏";
  if (type === "combat") return "动作间回到预备姿势，按节拍重复";
  if (type === "olympic") return "分段准备，快速发力，动作结束后重置";
  if (/(?:跳箱|跳跃|纵跳|立定跳|弹跳|box jump)/i.test(name))
    return "快速起跳，落地缓冲并稳定后再做";
  if (type === "plyometrics") return "快速发力，稳定后再做下一次";
  if (item?.distance || /(?:胸前行走|农夫行走|farmer.s walk|carry|march)/i.test(name))
    return "稳步行进，保持躯干稳定";
  if (type === "isometric" || item?.hold || /(?:等长|静态|保持|isometric|\bhold\b)/i.test(name) ||
    /^(?:侧|反向|高位)?平板支撑(?:$|\s)/.test(move.name))
    return move.seconds ? "保持姿势并呼吸 " + move.seconds + " 秒" : "保持姿势，均匀呼吸";
  if (type === "mobility" || /(?:绕环|胸椎侧弯|扫地式活动|肩关节慢速|mobility)/i.test(name))
    return "慢速往返，在可控范围内活动";
  if (type === "stretching" || type === "yoga" || category === "拉伸恢复" || /(?:拉伸|伸展保持|瑜伽|stretch)/i.test(name))
    return "缓慢进入姿势，均匀呼吸后缓慢回位";
  if (type === "rehab" || type === "pilates") return "缓慢往返，配合呼吸";
  if (/(?:爆发|快推|快拉|快转|快步|explosive)/i.test(name) || /(?:快速(?:推|拉|转|发力)|爆发)/.test(move.cue ?? ""))
    return "快速发力，有控制地回位";
  if (/(?:低台单腿慢下踩|慢下放|慢放|慢降|slow eccentric|slow lowering)/i.test(name))
    return "3-0-1-0";
  if (category === "有氧训练") return "保持均匀节奏，按本次强度完成";
  if (move.seconds && !move.reps) return "在 " + move.seconds + " 秒内保持稳定、可控的节奏";
  return "2-0-1-0";
}

export function exerciseTempo(move: TempoMove, item?: TempoCatalogue, category?: string) {
  const prescribed = move.tempo?.trim() || tempoFromCue(move.cue ?? "") || tempoFromCue(move.name);
  const text = prescribed ? normalizeTempo(prescribed) : suggestedTempo(move, item, category);
  return { label: prescribed ? "计划节奏" : "建议节奏", text, numeric: phasePattern.test(text) };
}
