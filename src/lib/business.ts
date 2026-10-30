import { z } from "zod";
import type { Language } from "./types";

export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function daysAgo(days: number, from = todayInIndia()): string {
  const value = new Date(`${from}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}
export function money(
  paise: number,
  lang: Language = "en",
  compact = false,
): string {
  return new Intl.NumberFormat(lang === "kn" ? "kn-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
    ...(compact
      ? { notation: "compact" as const, maximumFractionDigits: 1 }
      : {}),
  }).format(paise / 100);
}
export function toPaise(value: string | number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000)
    throw new Error("Enter a valid amount between ₹0 and ₹1,00,00,000.");
  return Math.round((amount + Number.EPSILON) * 100);
}
export function quantity(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(
    value,
  );
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
export const reportRangeSchema = z
  .object({ start: dateSchema, end: dateSchema })
  .refine(({ start, end }) => {
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    return days >= 0 && days <= 366;
  }, "Choose a date range of up to 367 days");
export const draftSchema = z.object({
  kind: z.enum(["sale", "product", "expense"]),
  product_id: z.string().uuid().nullable(),
  name: z.string().max(120).nullable(),
  kannada_name: z.string().max(120).nullable(),
  category: z.string().max(60).nullable(),
  unit: z.enum(["piece", "kg", "litre", "pack"]).nullable(),
  quantity: z.number().nonnegative().max(1_000_000).nullable(),
  price: z.number().nonnegative().max(10_000_000).nullable(),
  cost: z.number().nonnegative().max(10_000_000).nullable(),
  threshold: z.number().nonnegative().max(1_000_000).nullable(),
  description: z.string().max(240).nullable(),
  amount: z.number().positive().max(10_000_000).nullable(),
  date: dateSchema.nullable(),
  stock_change: z.enum(["set", "add"]).nullable(),
  warning: z.string().max(300).nullable(),
});
