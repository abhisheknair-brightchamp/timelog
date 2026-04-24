// src/lib/db.ts
// All Supabase database operations — replaces Apps Script handlers.
// Every function is fire-and-forget safe: callers can .catch(console.error).

import { supabase } from "./supabase";
import type {
  Employee,
  Timesheet,
  TimesheetEntry,
  Holiday,
  LeaveRequest,
  TimesheetQuery,
  AuditEntry,
  EmployeeNotification,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  MAPPERS: snake_case DB rows → camelCase app types                  */
/* ------------------------------------------------------------------ */

function mapEmployee(r: any): Employee {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    verticals: r.verticals || [],
    timezone: r.timezone || "Asia/Kolkata",
    weekoffs: r.weekoffs || [],
    minHoursPerDay: Number(r.min_hours_per_day) || 8,
    active: r.active !== false,
    createdAt: Number(r.created_at) || Date.now(),
  };
}

function mapTimesheet(r: any, entryMap: Record<string, TimesheetEntry[]>): Timesheet {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: r.date,
    entries: entryMap[r.id] || [],
    totalHours: Number(r.total_hours) || 0,
    capturedHours: r.captured_hours != null ? Number(r.captured_hours) : undefined,
    adjustedHours: r.adjusted_hours != null ? Number(r.adjusted_hours) : undefined,
    submitted: r.submitted === true,
    submittedAt: r.submitted_at ? Number(r.submitted_at) : undefined,
    submittedFromTz: r.submitted_from_tz || "Asia/Kolkata",
    startedAt: r.started_at ? Number(r.started_at) : undefined,
    endedAt: r.ended_at ? Number(r.ended_at) : undefined,
    status: (r.status || "in-progress") as Timesheet["status"],
    rejectedAt: r.rejected_at ? Number(r.rejected_at) : undefined,
    rejectedBy: r.rejected_by || undefined,
    rejectedByName: r.rejected_by_name || undefined,
    rejectionReason: r.rejection_reason || undefined,
  };
}

function mapHoliday(r: any): Holiday {
  return { id: r.id, date: r.date, name: r.name };
}

function mapLeave(r: any): LeaveRequest {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: r.date,
    type: r.type,
    note: r.note || "",
    appliedAt: Number(r.applied_at) || Date.now(),
  };
}

function mapQuery(r: any): TimesheetQuery {
  let messages = [];
  try { messages = typeof r.messages === "string" ? JSON.parse(r.messages) : r.messages || []; } catch {}
  return {
    id: r.id,
    timesheetId: r.timesheet_id,
    employeeId: r.employee_id,
    byActorId: r.by_actor_id,
    byActorName: r.by_actor_name || "",
    question: r.question || "",
    response: r.response || undefined,
    messages,
    status: (r.status === "resolved" ? "resolved" : "open") as "open" | "resolved",
    createdAt: Number(r.created_at) || Date.now(),
    respondedAt: r.responded_at ? Number(r.responded_at) : undefined,
    resolvedAt: r.resolved_at ? Number(r.resolved_at) : undefined,
  };
}

function mapNotification(r: any): EmployeeNotification {
  return {
    id: r.id,
    employeeId: r.employee_id,
    type: r.type,
    message: r.message || "",
    createdAt: Number(r.created_at) || Date.now(),
    read: r.read === true,
    timesheetDate: r.timesheet_date || undefined,
  };
}

function mapAudit(r: any): AuditEntry {
  return {
    id: r.id,
    timestamp: Number(r.timestamp_utc) || Date.now(),
    type: r.type,
    actorId: r.actor_id,
    actorName: r.actor_name || "",
    subject: r.subject || "",
    action: r.action || "",
    diff: r.diff || undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  FETCH ALL — called on app boot                                     */
/* ------------------------------------------------------------------ */

export async function fetchAllData() {
  const [
    { data: empRows },
    { data: tsRows },
    { data: entryRows },
    { data: holidayRows },
    { data: leaveRows },
    { data: queryRows },
    { data: notifRows },
    { data: auditRows },
    { data: configRows },
  ] = await Promise.all([
    supabase.from("employees").select("*"),
    supabase.from("timesheets").select("*"),
    supabase.from("timesheet_entries").select("*"),
    supabase.from("holidays").select("*"),
    supabase.from("leaves").select("*"),
    supabase.from("queries").select("*"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("audit_log").select("*").order("timestamp_utc", { ascending: false }),
    supabase.from("config").select("*"),
  ]);

  // Build entry map: timesheetId → entries[]
  const entryMap: Record<string, TimesheetEntry[]> = {};
  (entryRows || []).forEach((r: any) => {
    const tsId = r.timesheet_id;
    if (!entryMap[tsId]) entryMap[tsId] = [];
    entryMap[tsId].push({ vertical: r.vertical, note: r.note || "", hours: Number(r.hours) || 0 });
  });

  const employees = (empRows || []).map(mapEmployee);
  const timesheets = (tsRows || []).map((r: any) => mapTimesheet(r, entryMap));
  const holidays = (holidayRows || []).map(mapHoliday);
  const leaves = (leaveRows || []).map(mapLeave);
  const queries = (queryRows || []).map(mapQuery);
  const notifications = (notifRows || []).map(mapNotification);
  const auditLog = (auditRows || []).map(mapAudit);

  // Config as key-value pairs
  const config = (configRows || []) as Array<{ key: string; value: string }>;

  return { employees, timesheets, holidays, leaves, queries, notifications, auditLog, config };
}

/* ------------------------------------------------------------------ */
/*  EMPLOYEES                                                          */
/* ------------------------------------------------------------------ */

export async function dbAddEmployee(e: Employee) {
  const { error } = await supabase.from("employees").insert({
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    verticals: e.verticals,
    timezone: e.timezone,
    weekoffs: e.weekoffs,
    min_hours_per_day: e.minHoursPerDay,
    active: e.active,
    created_at: e.createdAt,
  });
  if (error) throw error;
}

export async function dbUpdateEmployee(id: string, patch: Partial<Employee>) {
  const row: any = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.verticals !== undefined) row.verticals = patch.verticals;
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.weekoffs !== undefined) row.weekoffs = patch.weekoffs;
  if (patch.minHoursPerDay !== undefined) row.min_hours_per_day = patch.minHoursPerDay;
  if (patch.active !== undefined) row.active = patch.active;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("employees").update(row).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  CONFIG                                                             */
/* ------------------------------------------------------------------ */

export async function dbSetConfig(key: string, value: string) {
  const { error } = await supabase.from("config").upsert({ key, value });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  HOLIDAYS                                                           */
/* ------------------------------------------------------------------ */

export async function dbAddHoliday(h: Holiday) {
  const { error } = await supabase.from("holidays").insert({ id: h.id, date: h.date, name: h.name });
  if (error) throw error;
}

export async function dbRemoveHoliday(id: string) {
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  TIMESHEETS                                                         */
/* ------------------------------------------------------------------ */

export async function dbUpsertTimesheet(ts: Timesheet) {
  const { error } = await supabase.from("timesheets").upsert({
    id: ts.id,
    employee_id: ts.employeeId,
    date: ts.date,
    total_hours: ts.totalHours,
    captured_hours: ts.capturedHours ?? null,
    adjusted_hours: ts.adjustedHours ?? null,
    submitted: ts.submitted,
    submitted_at: ts.submittedAt ?? null,
    submitted_from_tz: ts.submittedFromTz,
    started_at: ts.startedAt ?? null,
    ended_at: ts.endedAt ?? null,
    status: ts.status || "in-progress",
    rejected_at: ts.rejectedAt ?? null,
    rejected_by: ts.rejectedBy ?? null,
    rejected_by_name: ts.rejectedByName ?? null,
    rejection_reason: ts.rejectionReason ?? null,
  });
  if (error) throw error;

  // Sync entries: delete old, insert new
  if (ts.entries?.length) {
    await supabase.from("timesheet_entries").delete().eq("timesheet_id", ts.id);
    const { error: entryErr } = await supabase.from("timesheet_entries").insert(
      ts.entries.map((e) => ({
        timesheet_id: ts.id,
        vertical: e.vertical,
        note: e.note || "",
        hours: e.hours,
      }))
    );
    if (entryErr) throw entryErr;
  } else {
    // Clear any stale entries when timesheet is reset
    await supabase.from("timesheet_entries").delete().eq("timesheet_id", ts.id);
  }
}

export async function dbRejectTimesheet(
  id: string,
  reason: string,
  rejectedBy: string,
  rejectedByName: string,
  rejectedAt: number
) {
  const { error } = await supabase.from("timesheets").update({
    status: "rejected",
    rejected_at: rejectedAt,
    rejected_by: rejectedBy,
    rejected_by_name: rejectedByName,
    rejection_reason: reason,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbReverseRejection(id: string) {
  const { error } = await supabase.from("timesheets").update({
    status: "submitted",
    rejected_at: null,
    rejected_by: null,
    rejected_by_name: null,
    rejection_reason: null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbAdjustTimesheet(id: string, adjustedHours: number) {
  const { error } = await supabase
    .from("timesheets")
    .update({ adjusted_hours: adjustedHours })
    .eq("id", id);
  if (error) throw error;
}

export async function dbDeleteTimesheet(id: string) {
  const { error } = await supabase.from("timesheets").delete().eq("id", id);
  if (error) throw error;
}

export async function dbResetCheckout(id: string) {
  const { error } = await supabase.from("timesheets").update({
    ended_at: null,
    total_hours: 0,
    captured_hours: null,
    submitted: false,
    submitted_at: null,
    status: "in-progress",
  }).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  LEAVES                                                             */
/* ------------------------------------------------------------------ */

export async function dbApplyLeave(leave: LeaveRequest) {
  const { error } = await supabase.from("leaves").upsert({
    id: leave.id,
    employee_id: leave.employeeId,
    date: leave.date,
    type: leave.type,
    note: leave.note,
    applied_at: leave.appliedAt,
  });
  if (error) throw error;
}

export async function dbCancelLeave(id: string) {
  const { error } = await supabase.from("leaves").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  QUERIES                                                            */
/* ------------------------------------------------------------------ */

export async function dbCreateQuery(q: TimesheetQuery) {
  const { error } = await supabase.from("queries").insert({
    id: q.id,
    timesheet_id: q.timesheetId,
    employee_id: q.employeeId,
    by_actor_id: q.byActorId,
    by_actor_name: q.byActorName,
    question: q.question,
    messages: q.messages,
    status: q.status,
    created_at: q.createdAt,
  });
  if (error) throw error;
}

export async function dbUpdateQuery(
  id: string,
  patch: {
    messages?: any[];
    response?: string;
    responded_at?: number;
    status?: string;
    resolved_at?: number;
  }
) {
  const { error } = await supabase.from("queries").update(patch).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  NOTIFICATIONS                                                      */
/* ------------------------------------------------------------------ */

export async function dbAddNotification(n: EmployeeNotification) {
  const { error } = await supabase.from("notifications").insert({
    id: n.id,
    employee_id: n.employeeId,
    type: n.type,
    message: n.message,
    created_at: n.createdAt,
    read: n.read,
    timesheet_date: n.timesheetDate ?? null,
  });
  if (error) throw error;
}

export async function dbMarkNotificationsRead(employeeId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("employee_id", employeeId)
    .eq("read", false);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  AUDIT LOG                                                          */
/* ------------------------------------------------------------------ */

export async function dbAddAudit(entry: AuditEntry) {
  const { error } = await supabase.from("audit_log").insert({
    id: entry.id,
    timestamp_utc: entry.timestamp,
    type: entry.type,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    subject: entry.subject,
    action: entry.action,
    diff: entry.diff ?? null,
  });
  if (error) throw error;
}
