import { z } from "zod";

export const dateSchema = z.string().date();

export function asDate(value: number | Date = Date.now(), timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function offsetDate(date: string, offset: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
export const weekdayIndex = (date: string) => (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
export const shortDate = (date: string) => Number(date.slice(5, 7)) + "月" + Number(date.slice(8)) + "日";
