import { measurements } from "@/features/body/measurements";
import { isWarmupMove } from "@/features/training/sequence";
import type { Backup } from "./model";

type Cell = string | number | undefined;

function csvCell(value: Cell) {
  if (value === undefined) return "";
  if (typeof value === "number") return String(value);
  // Quoting alone does not prevent spreadsheet applications from evaluating a formula.
  const flattened = value.normalize("NFKC").replace(/^[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}]+/u, "");
  const prefix = /^[=+\-@]/.test(flattened) || /^[\t\r\n]/.test(value) ? "'" : "";
  return '"' + prefix + value.replaceAll('"', '""') + '"';
}

function spreadsheet(headers: string[], rows: Cell[][]) {
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function utc(timestamp?: number) {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

const sessionColumns = [
  "日期", "训练 ID", "训练名称", "训练类别", "开始时间（UTC）", "结束时间（UTC）", "训练时长（分钟）", "视频已完成",
  "有氧类型", "有氧时长（秒）", "距离（km）", "速度（km/h）", "坡度", "坡度单位", "行类型",
];
const setColumns = [
  "动作序号", "动作名称", "动作库 ID", "组序号", "组类型", "重量", "重量单位", "次数", "右侧重量", "右侧次数", "RPE",
  "计时（秒）", "循环组别", "组内动作标记", "器械站", "计划节奏",
];

export function trainingCsv(training: Backup["training"]) {
  const records = training.filter((row) => row.kind === "log").sort((a, b) =>
    a.data.date.localeCompare(b.data.date) || a.data.started - b.data.started || a.id.localeCompare(b.id));
  const rows = records.flatMap(({ id, data }) => {
    const cardio = data.cardio;
    const common: Cell[] = [
      data.date, id, data.plan.title, data.plan.category, utc(data.started), utc(data.ended), data.minutes, data.finishedVideo ? "是" : "",
      cardio?.activity === "incline-walk" ? "爬坡走" : undefined, cardio?.durationSeconds, cardio?.distanceKm, cardio?.speedKmh,
      cardio?.incline?.value, cardio?.incline?.kind === "percent" ? "%" : cardio?.incline?.kind === "level" ? "档" : undefined,
    ];
    const sets = data.plan.exercises.flatMap((move, exercise) => (data.rows[exercise] ?? []).flatMap((line, index) => line.done ? [[
      ...common, "完成组", exercise + 1, move.name, move.catalogueId, index + 1,
      line.kind === "warmup" || isWarmupMove(move) ? "热身" : line.kind === "drop" ? "递减" : "正式",
      line.weight, move.unit, line.reps, line.right?.weight, line.right?.reps, line.rpe, line.seconds,
      move.block, move.sourceSlot, move.station, move.tempo,
    ]] : []));
    return sets.length ? sets : [[...common, cardio ? "有氧记录" : data.finishedVideo ? "视频跟练" : "训练记录", ...setColumns.map(() => undefined)]];
  });
  return spreadsheet([...sessionColumns, ...setColumns], rows);
}

export function bodyCsv(library: Backup["library"]) {
  const rows = library.flatMap<{ date: string; id: string; metric: keyof typeof measurements; value: number }>((row) => {
    if (row.kind !== "nutrition") return [];
    const { entry } = row;
    if (entry.type === "weight") return [{ date: row.date, id: row.id, metric: "weight" as const, value: entry.kg }];
    if (entry.type === "measurement") return [{ date: row.date, id: row.id, metric: entry.metric, value: entry.value }];
    return [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return spreadsheet(["日期", "记录 ID", "指标", "数值", "单位"], rows.map(({ date, id, metric, value }) =>
    [date, id, measurements[metric].name, value, measurements[metric].unit]));
}
