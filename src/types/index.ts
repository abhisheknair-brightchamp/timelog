// src/types/index.ts

export type Portal = "admin" | "account" | "timesheet";

export type Role = string; // dynamic from config
export type Vertical = string; // dynamic from config

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  verticals: Vertical[];
  timezone: string; // IANA e.g. "Asia/Kolkata"
  weekoffs: number[]; // 0=Sun … 6=Sat
  minHoursPerDay: number;
  active: boolean;
  createdAt: number; // UTC ms
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface TimesheetEntry {
  vertical: Vertical;
  note: string;
  hours: number;
}

export type TimesheetStatus = "in-progress" | "submitted";

export interface Timesheet {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD in employee's local tz
  entries: TimesheetEntry[];
  totalHours: number; // sum of entry hours (employee's breakdown)
  capturedHours?: number; // wall-clock elapsed between startedAt and endedAt
  submitted: boolean;
  submittedAt?: number; // UTC ms
  submittedFromTz: string; // IANA
  startedAt?: number; // UTC ms — when they clocked in
  endedAt?: number; // UTC ms — when they clocked out
  status?: TimesheetStatus; // "in-progress" while clocked in
}

export type AuditType = "profile" | "timesheet" | "config" | "onboard" | "query";

export interface AuditEntry {
  id: string;
  timestamp: number; // UTC ms
  type: AuditType;
  actorId: string;
  actorName: string;
  subject: string; // employee name or entity name
  action: string;
  diff?: Array<{ field: string; from: string; to: string }>;
}

export interface OrgConfig {
  roles: string[];
  verticals: string[];
  sheetsUrl: string;
}

export type DayStatus =
  | "logged"
  | "missing"
  | "weekoff"
  | "holiday"
  | "upcoming"
  | "future"
  | "leave"
  | "in-progress";

export type LeaveType = "sick" | "annual" | "other";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: LeaveType;
  note: string;
  appliedAt: number; // UTC ms
}

export interface TimesheetQuery {
  id: string;
  timesheetId: string;
  employeeId: string;
  byActorId: string;
  byActorName: string;
  question: string;
  response?: string;
  status: "open" | "resolved";
  createdAt: number; // UTC ms
  respondedAt?: number; // UTC ms
  resolvedAt?: number; // UTC ms
}
