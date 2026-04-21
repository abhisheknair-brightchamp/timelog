// src/lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Employee,
  Holiday,
  Timesheet,
  LeaveRequest,
  LeaveType,
  AuditEntry,
  OrgConfig,
  Portal,
  AuditType,
} from "@/types";
import { nowInTz, todayInTz, dateKey } from "./utils";

interface AppState {
  // Auth / session
  currentEmployeeId: string; // "admin" or employee id
  currentEmail: string;
  isAuthenticated: boolean;
  portal: Portal;
  setPortal: (p: Portal) => void;
  setCurrentEmployee: (id: string) => void;
  setAuth: (email: string, role: string, employeeId?: string | null) => void;
  logout: () => void;

  // Org config
  config: OrgConfig;
  updateConfig: (partial: Partial<OrgConfig>) => void;
  addRole: (role: string) => void;
  removeRole: (role: string) => void;
  addVertical: (v: string) => void;
  removeVertical: (v: string) => void;

  // Employees
  employees: Employee[];
  addEmployee: (e: Omit<Employee, "id" | "createdAt">) => void;
  updateEmployee: (
    id: string,
    patch: Partial<Employee>,
    actorId: string
  ) => void;

  // Holidays
  holidays: Holiday[];
  addHoliday: (h: Omit<Holiday, "id">) => void;
  removeHoliday: (id: string) => void;

  // Timesheets
  timesheets: Timesheet[];
  submitTimesheet: (ts: Omit<Timesheet, "id">) => void;
  getTimesheet: (employeeId: string, date: string) => Timesheet | undefined;

  // Leaves
  leaves: LeaveRequest[];
  applyLeave: (empId: string, date: string, type: LeaveType, note: string) => void;
  cancelLeave: (leaveId: string) => void;
  getLeave: (empId: string, date: string) => LeaveRequest | undefined;

  // Audit
  auditLog: AuditEntry[];
  addAudit: (
    type: AuditType,
    actorId: string,
    subject: string,
    action: string,
    diff?: AuditEntry["diff"]
  ) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED_EMPLOYEES: Employee[] = [
  {
    id: "e1",
    name: "Arjun Sharma",
    email: "arjun@timelog.in",
    role: "Instructor",
    verticals: ["Roblox", "Coding"],
    timezone: "Asia/Kolkata",
    weekoffs: [0, 6],
    minHoursPerDay: 8,
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "e2",
    name: "Priya Nair",
    email: "priya@timelog.in",
    role: "Trainer",
    verticals: ["Maths", "English"],
    timezone: "Asia/Dubai",
    weekoffs: [5, 6],
    minHoursPerDay: 8,
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "e3",
    name: "Rohit Verma",
    email: "rohit@timelog.in",
    role: "Team Lead",
    verticals: ["Chess", "Coding"],
    timezone: "America/New_York",
    weekoffs: [6],
    minHoursPerDay: 8,
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "e4",
    name: "Sneha Iyer",
    email: "sneha@timelog.in",
    role: "Instructor",
    verticals: ["English"],
    timezone: "Asia/Kolkata",
    weekoffs: [0, 6],
    minHoursPerDay: 6,
    active: true,
    createdAt: Date.now(),
  },
  {
    id: "e5",
    name: "Kiran Rao",
    email: "kiran@timelog.in",
    role: "Trainer",
    verticals: ["Roblox", "Maths", "Chess"],
    timezone: "Asia/Singapore",
    weekoffs: [5, 6],
    minHoursPerDay: 8,
    active: true,
    createdAt: Date.now(),
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentEmployeeId: "",
      currentEmail: "",
      isAuthenticated: false,
      portal: "admin",
      setPortal: (portal) => set({ portal }),
      setCurrentEmployee: (id) => set({ currentEmployeeId: id }),
      setAuth: (email, role, employeeId) => {
        set({
          currentEmail: email,
          currentEmployeeId: employeeId || "admin",
          isAuthenticated: true,
          portal: role === "admin" ? "admin" : "timesheet",
        });
      },
      logout: () => {
        set({
          currentEmail: "",
          currentEmployeeId: "",
          isAuthenticated: false,
          portal: "admin",
        });
      },

      config: {
        roles: ["Admin", "Instructor", "Team Lead", "Trainer"],
        verticals: ["Roblox", "Coding", "Maths", "English", "Chess"],
        sheetsUrl: "",
      },
      updateConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),
      addRole: (role) => {
        set((s) => ({
          config: { ...s.config, roles: [...s.config.roles, role] },
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added role: "${role}"`);
      },
      removeRole: (role) => {
        set((s) => ({
          config: { ...s.config, roles: s.config.roles.filter((r) => r !== role) },
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Removed role: "${role}"`);
      },
      addVertical: (v) => {
        set((s) => ({
          config: { ...s.config, verticals: [...s.config.verticals, v] },
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added vertical: "${v}"`);
      },
      removeVertical: (v) => {
        set((s) => ({
          config: {
            ...s.config,
            verticals: s.config.verticals.filter((x) => x !== v),
          },
          employees: s.employees.map((e) => ({
            ...e,
            verticals: e.verticals.filter((x) => x !== v),
          })),
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Removed vertical: "${v}" — unassigned from all employees`);
      },

      employees: SEED_EMPLOYEES,
      addEmployee: (data) => {
        const e: Employee = { ...data, id: uid(), createdAt: Date.now() };
        set((s) => ({ employees: [...s.employees, e] }));
        get().addAudit(
          "onboard",
          get().currentEmployeeId,
          e.name,
          `Onboarded ${e.name} as ${e.role} — verticals: ${e.verticals.join(", ") || "none"}`
        );
      },
      updateEmployee: (id, patch, actorId) => {
        const old = get().employees.find((e) => e.id === id);
        if (!old) return;
        const diff: AuditEntry["diff"] = [];
        (Object.keys(patch) as (keyof Employee)[]).forEach((k) => {
          const ov = JSON.stringify(old[k]);
          const nv = JSON.stringify(patch[k]);
          if (ov !== nv)
            diff.push({ field: k, from: String(old[k]), to: String(patch[k]) });
        });
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        }));
        if (diff.length) {
          const actor = get().employees.find((e) => e.id === actorId);
          get().addAudit(
            "profile",
            actorId,
            old.name,
            `Profile updated for ${old.name}`,
            diff
          );
        }
      },

      holidays: [
        { id: "h1", date: "2025-01-26", name: "Republic Day" },
        { id: "h2", date: "2025-08-15", name: "Independence Day" },
        { id: "h3", date: "2025-10-23", name: "Diwali" },
        { id: "h4", date: "2025-12-25", name: "Christmas" },
      ],
      addHoliday: (h) => {
        const nh = { ...h, id: uid() };
        set((s) => ({
          holidays: [...s.holidays, nh].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added holiday: ${h.name} (${h.date})`);
      },
      removeHoliday: (id) => {
        const h = get().holidays.find((x) => x.id === id);
        set((s) => ({ holidays: s.holidays.filter((x) => x.id !== id) }));
        if (h) get().addAudit("config", get().currentEmployeeId, "System", `Removed holiday: ${h.name}`);
      },

      timesheets: [],
      submitTimesheet: (data) => {
        const ts: Timesheet = { ...data, id: uid() };
        set((s) => {
          const filtered = s.timesheets.filter(
            (x) => !(x.employeeId === ts.employeeId && x.date === ts.date)
          );
          return { timesheets: [...filtered, ts] };
        });
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          ts.employeeId,
          emp?.name || ts.employeeId,
          `Submitted timesheet for ${ts.date} — ${ts.totalHours.toFixed(1)}h across ${ts.entries.length} entr${ts.entries.length === 1 ? "y" : "ies"}: ${ts.entries.map((e) => `${e.vertical} (${e.hours}h)`).join(", ")}`
        );
        // Push to Sheets if configured
        const url = get().config.sheetsUrl;
        if (url) {
          fetch(url, {
            method: "POST",
            body: JSON.stringify({ action: "submitTimesheet", data: ts }),
          }).catch(() => {});
        }
      },
      getTimesheet: (employeeId, date) =>
        get().timesheets.find(
          (t) => t.employeeId === employeeId && t.date === date
        ),

      leaves: [],
      applyLeave: (empId, date, type, note) => {
        const leave: LeaveRequest = { id: uid(), employeeId: empId, date, type, note, appliedAt: Date.now() };
        set((s) => ({ leaves: [...s.leaves.filter((l) => !(l.employeeId === empId && l.date === date)), leave] }));
        const emp = get().employees.find((e) => e.id === empId);
        get().addAudit("profile", empId, emp?.name || empId, `Applied ${type} leave for ${date}${note ? `: ${note}` : ""}`);
      },
      cancelLeave: (leaveId) => {
        const leave = get().leaves.find((l) => l.id === leaveId);
        set((s) => ({ leaves: s.leaves.filter((l) => l.id !== leaveId) }));
        if (leave) get().addAudit("profile", leave.employeeId, leave.employeeId, `Cancelled ${leave.type} leave for ${leave.date}`);
      },
      getLeave: (empId, date) => get().leaves.find((l) => l.employeeId === empId && l.date === date),

      auditLog: [],
      addAudit: (type, actorId, subject, action, diff) => {
        const actor = get().employees.find((e) => e.id === actorId);
        const entry: AuditEntry = {
          id: uid(),
          timestamp: Date.now(),
          type,
          actorId,
          actorName: actorId === "admin" ? "Admin" : actor?.name || actorId,
          subject,
          action,
          diff,
        };
        set((s) => ({ auditLog: [entry, ...s.auditLog] }));
        // Push to Sheets if configured
        const url = get().config.sheetsUrl;
        if (url) {
          fetch(url, {
            method: "POST",
            body: JSON.stringify({ action: "addAudit", data: entry }),
          }).catch(() => {});
        }
      },
    }),
    { name: "timelog-v1" }
  )
);
