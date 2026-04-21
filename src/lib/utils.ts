// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import type { DayStatus, Employee, Holiday, Timesheet } from "@/types";

/** System go-live date — no day before this is considered "missed" in analytics. */
export const FIRST_USAGE_DATE = "2026-04-21";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Get current UTC ms offset to a given IANA timezone (approximate using Intl) */
export function tzOffsetMs(iana: string): number {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const localStr = now.toLocaleString("en-US", { timeZone: iana });
  return new Date(localStr).getTime() - new Date(utcStr).getTime();
}

/** Current time in given timezone */
export function nowInTz(iana: string): Date {
  const now = new Date();
  const localStr = now.toLocaleString("en-US", { timeZone: iana });
  return new Date(localStr);
}

/** Today's date string (YYYY-MM-DD) in given timezone */
export function todayInTz(iana: string): string {
  return nowInTz(iana).toISOString().slice(0, 10);
}

/** Format UTC ms as IST display string */
export function fmtIST(utcMs: number): string {
  return new Date(utcMs).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " IST";
}

/** Format UTC ms as time in given timezone */
export function fmtTime(utcMs: number, iana: string): string {
  return new Date(utcMs).toLocaleTimeString("en-US", {
    timeZone: iana,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function fmtDateLabel(s: string): string {
  const d = parseDateKey(s);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function getDayOfWeek(s: string): number {
  return parseDateKey(s).getDay();
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayName(n: number) {
  return DAY_NAMES[n];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const EMP_COLORS = [
  { bg: "#E1F5EE", text: "#0F6E56" },
  { bg: "#E6F1FB", text: "#185FA5" },
  { bg: "#FAEEDA", text: "#854F0B" },
  { bg: "#FBEAF0", text: "#993556" },
  { bg: "#FAECE7", text: "#993C1D" },
  { bg: "#EAF3DE", text: "#27500A" },
  { bg: "#EEEDFE", text: "#3C3489" },
];

export function empColor(index: number) {
  return EMP_COLORS[index % EMP_COLORS.length];
}

export function getDayStatus(
  employee: Employee,
  date: string,
  holidays: Holiday[],
  timesheets: Timesheet[],
  todayStr: string,
  leaves?: { employeeId: string; date: string }[]
): DayStatus {
  const dow = getDayOfWeek(date);
  if (employee.weekoffs.includes(dow)) return "weekoff";
  if (holidays.some((h) => h.date === date)) return "holiday";
  if (leaves?.some((l) => l.employeeId === employee.id && l.date === date)) return "leave";
  const sameDayShifts = timesheets.filter(
    (t) => t.employeeId === employee.id && t.date === date
  );
  if (sameDayShifts.some((t) => t.status === "in-progress")) return "in-progress";
  if (sameDayShifts.some((t) => t.submitted && t.status !== "rejected")) return "logged";
  if (date < todayStr) return "missing";
  if (date === todayStr) return "upcoming";
  return "future";
}

/** Authoritative worked hours for a shift — clock-in/out diff wins over any typed breakdown. */
export function getShiftHours(ts: Pick<Timesheet, "startedAt" | "endedAt" | "capturedHours" | "totalHours" | "status">): number {
  if (ts.status === "rejected") return 0;
  if (ts.startedAt && ts.endedAt) return Math.max(0, (ts.endedAt - ts.startedAt) / 3600000);
  if (typeof ts.capturedHours === "number") return ts.capturedHours;
  return ts.totalHours || 0;
}

export function sumShiftHours(shifts: Array<Parameters<typeof getShiftHours>[0]>): number {
  return shifts.reduce((sum, s) => sum + getShiftHours(s), 0);
}

export const TIMEZONES = [
  { label: "IST — India (+5:30)", iana: "Asia/Kolkata", short: "IST" },
  { label: "GST — Dubai (+4:00)", iana: "Asia/Dubai", short: "GST" },
  { label: "SGT — Singapore (+8:00)", iana: "Asia/Singapore", short: "SGT" },
  { label: "MYT — Kuala Lumpur (+8:00)", iana: "Asia/Kuala_Lumpur", short: "MYT" },
  { label: "PKT — Pakistan (+5:00)", iana: "Asia/Karachi", short: "PKT" },
  { label: "BST — Bangladesh (+6:00)", iana: "Asia/Dhaka", short: "BST" },
  { label: "NPT — Nepal (+5:45)", iana: "Asia/Kathmandu", short: "NPT" },
  { label: "UTC — London (±0)", iana: "Europe/London", short: "UTC" },
  { label: "CET — Berlin (+1:00)", iana: "Europe/Berlin", short: "CET" },
  { label: "MSK — Moscow (+3:00)", iana: "Europe/Moscow", short: "MSK" },
  { label: "EST — New York (−5:00)", iana: "America/New_York", short: "EST" },
  { label: "EDT — New York DST (−4:00)", iana: "America/New_York", short: "EDT" },
  { label: "CST — Chicago (−6:00)", iana: "America/Chicago", short: "CST" },
  { label: "CDT — Chicago DST (−5:00)", iana: "America/Chicago", short: "CDT" },
  { label: "MST — Denver (−7:00)", iana: "America/Denver", short: "MST" },
  { label: "MDT — Denver DST (−6:00)", iana: "America/Denver", short: "MDT" },
  { label: "MST — Phoenix, no DST (−7:00)", iana: "America/Phoenix", short: "MST" },
  { label: "PST — Los Angeles (−8:00)", iana: "America/Los_Angeles", short: "PST" },
  { label: "PDT — Los Angeles DST (−7:00)", iana: "America/Los_Angeles", short: "PDT" },
  { label: "AKST — Alaska (−9:00)", iana: "America/Anchorage", short: "AKST" },
  { label: "HST — Hawaii (−10:00)", iana: "Pacific/Honolulu", short: "HST" },
  { label: "AEST — Sydney (+10:00)", iana: "Australia/Sydney", short: "AEST" },
  { label: "JST — Tokyo (+9:00)", iana: "Asia/Tokyo", short: "JST" },
];

export function tzByIana(iana: string) {
  return TIMEZONES.find((t) => t.iana === iana) || TIMEZONES[0];
}
