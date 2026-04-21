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

export interface Timesheet {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD in employee's local tz
  entries: TimesheetEntry[];
  totalHours: number;
  submitted: boolean;
  submittedAt?: number; // UTC ms
  submittedFromTz: string; // IANA
}

export type AuditType = "profile" | "timesheet" | "config" | "onboard";

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
  | "leave";

export type LeaveType = "sick" | "annual" | "other";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: LeaveType;
  note: string;
  appliedAt: number; // UTC ms
}
