// src/lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StoreApi } from "zustand";
import type {
  Employee,
  Holiday,
  Timesheet,
  TimesheetEntry,
  TimesheetQuery,
  QueryMessage,
  LeaveRequest,
  LeaveType,
  AuditEntry,
  OrgConfig,
  Portal,
  AuditType,
  EmployeeNotification,
  NotificationType,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  CROSS-BROWSER SYNC REALITY CHECK                                   */
/* ------------------------------------------------------------------ */
/*  localStorage is scoped to: origin + browser profile.               */
/*  It will NEVER sync across Chrome ↔ Firefox ↔ Safari.               */
/*                                                                     */
/*  Cross-browser sync MUST go through a backend (your Sheets layer).  */
/*                                                                     */
/*  RECOMMENDED PATTERN:                                               */
/*  1. On app mount, call useStore.getState().loadFromSheets(data)     */
/*     to hydrate state from Sheets.                                   */
/*  2. Keep sheetsPost() as your write-path for every mutation.        */
/*  3. The persist middleware below only caches auth + portal so the   */
/*     user stays logged in across reloads.                            */
/* ------------------------------------------------------------------ */

interface AppState {
  // Auth / session
  currentEmployeeId: string;
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

  // Timesheets / shifts (multiple per day allowed)
  timesheets: Timesheet[];
  submitTimesheet: (ts: Omit<Timesheet, "id">) => void;
  getTimesheet: (employeeId: string, date: string) => Timesheet | undefined;
  getShifts: (employeeId: string, date: string) => Timesheet[];
  getActiveShift: (employeeId: string) => Timesheet | undefined;
  startWorkday: (employeeId: string, date: string, tz: string) => string;
  endWorkday: (tsId: string, entries: TimesheetEntry[]) => void;
  rejectTimesheet: (tsId: string, reason: string) => void;
  reverseRejection: (tsId: string) => void;
  adjustTimesheet: (tsId: string, hours: number) => void;
  resetShift: (tsId: string) => void;
  resetCheckin: (tsId: string) => void;
  resetCheckout: (tsId: string) => void;
  adminAddTimeLog: (
    empId: string,
    date: string,
    checkinMs: number,
    checkoutMs: number,
    entries: TimesheetEntry[]
  ) => void;

  // Leaves
  leaves: LeaveRequest[];
  applyLeave: (
    empId: string,
    date: string,
    type: LeaveType,
    note: string
  ) => void;
  cancelLeave: (leaveId: string) => void;
  getLeave: (empId: string, date: string) => LeaveRequest | undefined;

  // Queries
  queries: TimesheetQuery[];
  createQuery: (
    timesheetId: string,
    employeeId: string,
    question: string
  ) => void;
  addQueryMessage: (
    queryId: string,
    role: "admin" | "employee",
    text: string
  ) => void;
  respondQuery: (queryId: string, response: string) => void;
  resolveQuery: (queryId: string) => void;

  // Notifications
  notifications: EmployeeNotification[];
  addNotification: (
    empId: string,
    type: NotificationType,
    message: string,
    tsDate?: string
  ) => void;
  markNotificationsRead: (empId: string) => void;

  // Audit
  auditLog: AuditEntry[];
  addAudit: (
    type: AuditType,
    actorId: string,
    subject: string,
    action: string,
    diff?: AuditEntry["diff"]
  ) => void;

  // Sheets sync
  loadFromSheets: (data: any) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function sheetsPost(_url: string, action: string, data: any) {
  fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  }).catch((e) => console.error("sheetsPost failed:", action, e));
}

/* ------------------------------------------------------------------ */
/*  SAME-BROWSER CROSS-TAB SYNC (storage event)                        */
/*  Call once in your root layout:                                     */
/*    useEffect(() => syncTabs(useStore), []);                         */
/* ------------------------------------------------------------------ */
export function syncTabs(store: StoreApi<AppState>) {
  if (typeof window === "undefined") return;

  const handler = (e: StorageEvent) => {
    if (e.key === "timelog-v2" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.state) {
          store.setState({
            currentEmployeeId: parsed.state.currentEmployeeId,
            currentEmail: parsed.state.currentEmail,
            isAuthenticated: parsed.state.isAuthenticated,
            portal: parsed.state.portal,
          });
        }
      } catch {
        /* ignore corrupt storage */
      }
    }
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
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
        sheetsUrl: process.env.NEXT_PUBLIC_SHEETS_URL || "",
      },
      updateConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),
      addRole: (role) => {
        set((s) => ({
          config: { ...s.config, roles: [...s.config.roles, role] },
        }));
        get().addAudit(
          "config",
          get().currentEmployeeId,
          "System",
          `Added role: "${role}"`
        );
        sheetsPost(get().config.sheetsUrl, "addRole", { role });
      },
      removeRole: (role) => {
        set((s) => ({
          config: {
            ...s.config,
            roles: s.config.roles.filter((r) => r !== role),
          },
        }));
        get().addAudit(
          "config",
          get().currentEmployeeId,
          "System",
          `Removed role: "${role}"`
        );
        sheetsPost(get().config.sheetsUrl, "removeRole", { role });
      },
      addVertical: (v) => {
        set((s) => ({
          config: { ...s.config, verticals: [...s.config.verticals, v] },
        }));
        get().addAudit(
          "config",
          get().currentEmployeeId,
          "System",
          `Added vertical: "${v}"`
        );
        sheetsPost(get().config.sheetsUrl, "addVertical", { vertical: v });
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
        get().addAudit(
          "config",
          get().currentEmployeeId,
          "System",
          `Removed vertical: "${v}" — unassigned from all employees`
        );
        sheetsPost(get().config.sheetsUrl, "removeVertical", { vertical: v });
      },

      employees: SEED_EMPLOYEES,
      addEmployee: (data) => {
        const e: Employee = { ...data, id: uid(), createdAt: Date.now() };
        set((s) => ({ employees: [...s.employees, e] }));
        get().addAudit(
          "onboard",
          get().currentEmployeeId,
          e.name,
          `Onboarded ${e.name} as ${e.role} — verticals: ${
            e.verticals.join(", ") || "none"
          }`
        );
        sheetsPost(get().config.sheetsUrl, "addEmployee", e);
      },
      updateEmployee: (id, patch, actorId) => {
        const old = get().employees.find((e) => e.id === id);
        if (!old) return;
        const diff: AuditEntry["diff"] = [];
        (Object.keys(patch) as (keyof Employee)[]).forEach((k) => {
          const ov = JSON.stringify(old[k]);
          const nv = JSON.stringify(patch[k]);
          if (ov !== nv)
            diff.push({
              field: k,
              from: String(old[k]),
              to: String(patch[k]),
            });
        });
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        }));
        if (diff.length) {
          get().addAudit(
            "profile",
            actorId,
            old.name,
            `Profile updated for ${old.name}`,
            diff
          );
          sheetsPost(get().config.sheetsUrl, "updateEmployee", { id, patch });
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
        get().addAudit(
          "config",
          get().currentEmployeeId,
          "System",
          `Added holiday: ${h.name} (${h.date})`
        );
        sheetsPost(get().config.sheetsUrl, "addHoliday", nh);
      },
      removeHoliday: (id) => {
        const h = get().holidays.find((x) => x.id === id);
        set((s) => ({ holidays: s.holidays.filter((x) => x.id !== id) }));
        if (h) {
          get().addAudit(
            "config",
            get().currentEmployeeId,
            "System",
            `Removed holiday: ${h.name}`
          );
          sheetsPost(get().config.sheetsUrl, "removeHoliday", { id });
        }
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
          `Submitted timesheet for ${ts.date} — ${ts.totalHours.toFixed(
            1
          )}h across ${ts.entries.length} entr${
            ts.entries.length === 1 ? "y" : "ies"
          }: ${ts.entries
            .map((e) => `${e.vertical} (${e.hours}h)`)
            .join(", ")}`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", ts);
      },
      getTimesheet: (employeeId, date) =>
        get().timesheets.find(
          (t) => t.employeeId === employeeId && t.date === date
        ),
      getShifts: (employeeId, date) =>
        get().timesheets.filter(
          (t) => t.employeeId === employeeId && t.date === date
        ),
      getActiveShift: (employeeId) =>
        get().timesheets.find(
          (t) => t.employeeId === employeeId && t.status === "in-progress"
        ),
      startWorkday: (employeeId, date, tz) => {
        const active = get().timesheets.find(
          (t) => t.employeeId === employeeId && t.status === "in-progress" && t.date === date
        );
        if (active) return active.id;
        const ts: Timesheet = {
          id: uid(),
          employeeId,
          date,
          entries: [],
          totalHours: 0,
          submitted: false,
          submittedFromTz: tz,
          startedAt: Date.now(),
          status: "in-progress",
        };
        set((s) => ({ timesheets: [...s.timesheets, ts] }));
        const emp = get().employees.find((e) => e.id === employeeId);
        get().addAudit(
          "timesheet",
          employeeId,
          emp?.name || employeeId,
          `Clocked in for ${date}`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", ts);
        return ts.id;
      },
      endWorkday: (tsId, entries) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        const endedAt = Date.now();
        const capturedHours = ts.startedAt
          ? Math.round(
              Math.max(0, (endedAt - ts.startedAt) / 3600000) * 100
            ) / 100
          : 0;
        const updated: Timesheet = {
          ...ts,
          entries,
          totalHours: capturedHours,
          capturedHours,
          endedAt,
          submitted: true,
          submittedAt: endedAt,
          status: "submitted",
        };
        set((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === tsId ? updated : t
          ),
        }));
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        const breakdownSum = entries.reduce(
          (a, r) => a + (r.hours || 0),
          0
        );
        const summary = entries.length
          ? `${capturedHours.toFixed(
              2
            )}h on the clock · breakdown ${breakdownSum.toFixed(
              1
            )}h across ${entries.length} entr${
              entries.length === 1 ? "y" : "ies"
            }: ${entries
              .map((e) => `${e.vertical} (${e.hours}h)`)
              .join(", ")}`
          : `${capturedHours.toFixed(2)}h on the clock · no breakdown entered`;
        get().addAudit(
          "timesheet",
          ts.employeeId,
          emp?.name || ts.employeeId,
          `Clocked out for ${ts.date} — ${summary}`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", updated);
      },
      rejectTimesheet: (tsId, reason) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const updated: Timesheet = {
          ...ts,
          status: "rejected",
          rejectedAt: Date.now(),
          rejectedBy: actorId,
          rejectedByName: actorName,
          rejectionReason: reason,
        };
        set((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === tsId ? updated : t
          ),
        }));
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Rejected shift for ${ts.date}${reason ? ` — ${reason}` : ""}`
        );
        get().addNotification(
          ts.employeeId,
          "reject",
          `Your shift on ${ts.date} was rejected by ${actorName}${
            reason ? `: ${reason}` : ""
          }`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "rejectTimesheet", {
          id: tsId,
          reason,
          rejectedBy: actorId,
          rejectedByName: actorName,
          rejectedAt: updated.rejectedAt,
        });
      },
      reverseRejection: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts || ts.status !== "rejected") return;
        const updated: Timesheet = {
          ...ts,
          status: "submitted",
          rejectedAt: undefined,
          rejectedBy: undefined,
          rejectedByName: undefined,
          rejectionReason: undefined,
        };
        set((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === tsId ? updated : t
          ),
        }));
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Reversed rejection on shift for ${ts.date}`
        );
        get().addNotification(
          ts.employeeId,
          "reverse",
          `The rejection on your shift for ${ts.date} was reversed by ${actorName} — your hours are now accepted`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "reverseRejection", { id: tsId });
      },
      adjustTimesheet: (tsId, hours) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        set((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === tsId ? { ...t, adjustedHours: hours } : t
          ),
        }));
        const actorId = get().currentEmployeeId;
        const actorName = actorId === "admin" ? "Admin" : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Adjusted hours for ${ts.date} to ${hours.toFixed(2)}h (by ${actorName})`
        );
        get().addNotification(
          ts.employeeId,
          "reset",
          `Your logged hours for ${ts.date} were adjusted to ${hours.toFixed(2)}h by ${actorName}`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "adjustTimesheet", { id: tsId, adjustedHours: hours });
      },
      resetShift: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        set((s) => ({
          timesheets: s.timesheets.filter((t) => t.id !== tsId),
        }));
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Reset (full) shift for ${ts.date}`
        );
        get().addNotification(
          ts.employeeId,
          "reset",
          `Your shift record for ${ts.date} was fully reset by ${actorName} — please re-log your hours`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "resetShift", { id: tsId });
      },
      resetCheckin: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        // Delete the record entirely so the employee can clock in fresh.
        // Leaving an in-progress record with no startedAt creates a zombie
        // that blocks startWorkday from creating a new shift.
        set((s) => ({ timesheets: s.timesheets.filter((t) => t.id !== tsId) }));
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Reset check-in for shift on ${ts.date}`
        );
        get().addNotification(
          ts.employeeId,
          "reset",
          `Your check-in time for ${ts.date} was reset by ${actorName} — please clock in again`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "resetShift", { id: tsId });
      },
      resetCheckout: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        const updated: Timesheet = {
          ...ts,
          endedAt: undefined,
          totalHours: 0,
          capturedHours: 0,
          submitted: false,
          submittedAt: undefined,
          status: "in-progress",
        };
        set((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === tsId ? updated : t
          ),
        }));
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || ts.employeeId,
          `Reset check-out for shift on ${ts.date}`
        );
        get().addNotification(
          ts.employeeId,
          "reset",
          `Your check-out time for ${ts.date} was reset by ${actorName} — please clock out again`,
          ts.date
        );
        sheetsPost(get().config.sheetsUrl, "resetCheckout", { id: tsId });
      },
      adminAddTimeLog: (empId, date, checkinMs, checkoutMs, entries) => {
        const capturedHours =
          Math.round(
            Math.max(0, (checkoutMs - checkinMs) / 3600000) * 100
          ) / 100;
        const emp = get().employees.find((e) => e.id === empId);
        const ts: Timesheet = {
          id: uid(),
          employeeId: empId,
          date,
          entries,
          totalHours: capturedHours,
          capturedHours,
          submitted: true,
          submittedAt: Date.now(),
          submittedFromTz: emp?.timezone || "Asia/Kolkata",
          startedAt: checkinMs,
          endedAt: checkoutMs,
          status: "submitted",
        };
        set((s) => ({ timesheets: [...s.timesheets, ts] }));
        const actorId = get().currentEmployeeId;
        get().addAudit(
          "timesheet",
          actorId,
          emp?.name || empId,
          `Admin manually added time log for ${date} — ${capturedHours.toFixed(
            2
          )}h`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", ts);
      },

      leaves: [],
      applyLeave: (empId, date, type, note) => {
        const leave: LeaveRequest = {
          id: uid(),
          employeeId: empId,
          date,
          type,
          note,
          appliedAt: Date.now(),
        };
        set((s) => ({
          leaves: [
            ...s.leaves.filter(
              (l) => !(l.employeeId === empId && l.date === date)
            ),
            leave,
          ],
        }));
        const emp = get().employees.find((e) => e.id === empId);
        get().addAudit(
          "profile",
          empId,
          emp?.name || empId,
          `Applied ${type} leave for ${date}${note ? `: ${note}` : ""}`
        );
        sheetsPost(get().config.sheetsUrl, "applyLeave", leave);
      },
      cancelLeave: (leaveId) => {
        const leave = get().leaves.find((l) => l.id === leaveId);
        set((s) => ({ leaves: s.leaves.filter((l) => l.id !== leaveId) }));
        if (leave) {
          get().addAudit(
            "profile",
            leave.employeeId,
            leave.employeeId,
            `Cancelled ${leave.type} leave for ${leave.date}`
          );
          sheetsPost(get().config.sheetsUrl, "cancelLeave", { id: leaveId });
        }
      },
      getLeave: (empId, date) =>
        get().leaves.find((l) => l.employeeId === empId && l.date === date),

      queries: [],
      createQuery: (timesheetId, employeeId, question) => {
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const firstMsg: QueryMessage = {
          id: uid(),
          role: actorId === "admin" ? "admin" : "employee",
          actorName,
          text: question,
          createdAt: Date.now(),
        };
        const q: TimesheetQuery = {
          id: uid(),
          timesheetId,
          employeeId,
          byActorId: actorId,
          byActorName: actorName,
          question,
          messages: [firstMsg],
          status: "open",
          createdAt: Date.now(),
        };
        set((s) => ({ queries: [q, ...s.queries] }));
        const emp = get().employees.find((e) => e.id === employeeId);
        const ts = get().timesheets.find((t) => t.id === timesheetId);
        get().addAudit(
          "query",
          actorId,
          emp?.name || employeeId,
          `Raised query on ${emp?.name || employeeId}'s timesheet: "${question}"`
        );
        get().addNotification(
          employeeId,
          "query",
          `${actorName} has a question about your shift${
            ts?.date ? ` on ${ts.date}` : ""
          }: "${question}"`,
          ts?.date
        );
        sheetsPost(get().config.sheetsUrl, "createQuery", q);
      },
      addQueryMessage: (queryId, role, text) => {
        const q = get().queries.find((x) => x.id === queryId);
        if (!q) return;
        const actorId = get().currentEmployeeId;
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
        const msg: QueryMessage = {
          id: uid(),
          role,
          actorName,
          text,
          createdAt: Date.now(),
        };
        const updated: TimesheetQuery = {
          ...q,
          messages: [
            ...(q.messages || [
              {
                id: uid(),
                role: "admin",
                actorName: q.byActorName,
                text: q.question,
                createdAt: q.createdAt,
              },
            ]),
            msg,
          ],
          response: role === "employee" ? text : q.response,
          respondedAt: role === "employee" ? Date.now() : q.respondedAt,
        };
        set((s) => ({
          queries: s.queries.map((x) => (x.id === queryId ? updated : x)),
        }));
        const emp = get().employees.find((e) => e.id === q.employeeId);
        get().addAudit(
          "query",
          actorId,
          emp?.name || q.employeeId,
          `${role === "admin" ? "Admin replied" : "Employee replied"} on query: "${text}"`
        );
        if (role === "employee") {
          get().addNotification(
            "admin",
            "query",
            `${emp?.name || "Employee"} replied to your query${
              q.question
                ? ` "${q.question.slice(0, 40)}${
                    q.question.length > 40 ? "…" : ""
                  }"`
                : ""
            }`,
            undefined
          );
        } else {
          get().addNotification(
            q.employeeId,
            "query",
            `Admin replied to the query on your timesheet: "${text}"`,
            undefined
          );
        }
        sheetsPost(get().config.sheetsUrl, "addQueryMessage", {
          id: queryId,
          msg,
        });
      },
      respondQuery: (queryId, response) => {
        get().addQueryMessage(queryId, "employee", response);
      },
      resolveQuery: (queryId) => {
        const q = get().queries.find((x) => x.id === queryId);
        if (!q) return;
        const updated: TimesheetQuery = {
          ...q,
          status: "resolved",
          resolvedAt: Date.now(),
        };
        set((s) => ({
          queries: s.queries.map((x) => (x.id === queryId ? updated : x)),
        }));
        const actorId = get().currentEmployeeId;
        const emp = get().employees.find((e) => e.id === q.employeeId);
        get().addAudit(
          "query",
          actorId,
          emp?.name || q.employeeId,
          `Resolved query on ${emp?.name || q.employeeId}'s timesheet`
        );
        sheetsPost(get().config.sheetsUrl, "resolveQuery", {
          id: queryId,
          resolvedAt: updated.resolvedAt,
        });
      },

      notifications: [],
      addNotification: (empId, type, message, tsDate) => {
        const n: EmployeeNotification = {
          id: uid(),
          employeeId: empId,
          type,
          message,
          createdAt: Date.now(),
          read: false,
          timesheetDate: tsDate,
        };
        set((s) => ({ notifications: [n, ...s.notifications] }));
      },
      markNotificationsRead: (empId) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.employeeId === empId ? { ...n, read: true } : n
          ),
        }));
      },

      auditLog: [],
      addAudit: (type, actorId, subject, action, diff) => {
        const actor = get().employees.find((e) => e.id === actorId);
        const entry: AuditEntry = {
          id: uid(),
          timestamp: Date.now(),
          type,
          actorId,
          actorName:
            actorId === "admin" ? "Admin" : actor?.name || actorId,
          subject,
          action,
          diff,
        };
        set((s) => ({ auditLog: [entry, ...s.auditLog] }));
        sheetsPost(get().config.sheetsUrl, "addAudit", entry);
      },

      loadFromSheets: (data: any) => {
        // Employees
        if (data.employees?.length) {
          const employees: Employee[] = data.employees
            .filter((r: any) => r.id && r.email)
            .map((r: any) => ({
              id: String(r.id),
              name: String(r.name || ""),
              email: String(r.email || ""),
              role: String(r.role || ""),
              verticals: r.verticals
                ? String(r.verticals)
                    .split(",")
                    .map((v: string) => v.trim())
                    .filter(Boolean)
                : [],
              timezone: String(r.timezone || "Asia/Kolkata"),
              weekoffs: (r.weekoffs !== "" && r.weekoffs !== null && r.weekoffs !== undefined)
                ? String(r.weekoffs)
                    .split(",")
                    .map(Number)
                    .filter((n: number) => !isNaN(n))
                : [],
              minHoursPerDay: Number(r.minHoursPerDay) || 8,
              active: r.active !== "FALSE",
              createdAt: Number(r.createdAt_UTC) || Date.now(),
            }));
          if (employees.length) set({ employees });
        }

        // Holidays
        if (data.holidays?.length) {
          const holidays: Holiday[] = data.holidays
            .filter((r: any) => r.id && r.date)
            .map((r: any) => ({
              id: String(r.id),
              date: String(r.date),
              name: String(r.name || ""),
            }));
          if (holidays.length) set({ holidays });
        }

        // Leaves
        if (Array.isArray(data.leaves)) {
          const leaves: LeaveRequest[] = data.leaves
            .filter((r: any) => r.id && r.employeeId)
            .map((r: any) => ({
              id: String(r.id),
              employeeId: String(r.employeeId),
              date: String(r.date).slice(0, 10),
              type: (r.type || "other") as LeaveType,
              note: String(r.note || ""),
              appliedAt: Number(r.appliedAt_UTC) || Date.now(),
            }));
          set({ leaves });
        }

        // Queries
        if (data.queries?.length) {
          const queries: TimesheetQuery[] = data.queries
            .filter((r: any) => r.id && r.timesheetId)
            .map((r: any) => {
              const question = String(r.question || "");
              const createdAt = Number(r.createdAt_UTC) || Date.now();
              // Reconstruct messages: prefer persisted messagesJSON, else build from question+response
              let messages: QueryMessage[] = [];
              if (r.messagesJSON) {
                try { messages = JSON.parse(r.messagesJSON); } catch {}
              }
              if (!messages.length) {
                messages = [{ id: r.id + "_q", role: "admin", actorName: String(r.byActorName || "Admin"), text: question, createdAt }];
                if (r.response) {
                  messages.push({ id: r.id + "_r", role: "employee", actorName: "Employee", text: String(r.response), createdAt: Number(r.respondedAt_UTC) || createdAt + 1 });
                }
              }
              return {
                id: String(r.id),
                timesheetId: String(r.timesheetId),
                employeeId: String(r.employeeId),
                byActorId: String(r.byActorId),
                byActorName: String(r.byActorName || ""),
                question,
                response: r.response ? String(r.response) : undefined,
                messages,
                status: (r.status === "resolved" ? "resolved" : "open") as "open" | "resolved",
                createdAt,
                respondedAt: r.respondedAt_UTC ? Number(r.respondedAt_UTC) : undefined,
                resolvedAt: r.resolvedAt_UTC ? Number(r.resolvedAt_UTC) : undefined,
              };
            });
          if (queries.length) set({ queries });
        }

        // Config
        if (data.config?.length) {
          const configMap: Record<string, string> = {};
          data.config.forEach((r: any) => {
            if (r.key) configMap[r.key] = String(r.value || "");
          });

          const updates: Partial<OrgConfig> = {};
          if (configMap.roles)
            updates.roles = configMap.roles
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          if (configMap.verticals)
            updates.verticals = configMap.verticals
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);

          if (Object.keys(updates).length) {
            set((s) => ({ config: { ...s.config, ...updates } }));
          }
        }

        // Timesheets
        if (Array.isArray(data.timesheets)) {
          const entryMap: Record<string, TimesheetEntry[]> = {};

          if (data.timesheetEntries?.length) {
            data.timesheetEntries.forEach((r: any) => {
              const tsId = String(r.timesheetId);
              if (!entryMap[tsId]) entryMap[tsId] = [];

              entryMap[tsId].push({
                vertical: String(r.vertical || ""),
                hours: Number(r.hours) || 0,
                note: String(r.note || ""),
              });
            });
          }

          const timesheets: Timesheet[] = data.timesheets
            .filter((r: any) => r.id && r.employeeId)
            .map((r: any) => ({
              id: String(r.id),
              employeeId: String(r.employeeId),
              date: String(r.date).slice(0, 10),
              entries: entryMap[r.id] || [],
              totalHours: Number(r.totalHours) || 0,
              capturedHours: Number(r.capturedHours) || 0,
              submitted:
                r.submitted === "TRUE" || r.submitted === true,
              submittedAt: r.submittedAt_UTC
                ? Number(r.submittedAt_UTC)
                : undefined,
              submittedFromTz: String(
                r.submittedFromTz || "Asia/Kolkata"
              ),
              startedAt: r.startedAt_UTC
                ? Number(r.startedAt_UTC)
                : undefined,
              endedAt: r.endedAt_UTC
                ? Number(r.endedAt_UTC)
                : undefined,
              status: (r.status || "submitted") as Timesheet["status"],
              rejectedAt: r.rejectedAt_UTC
                ? Number(r.rejectedAt_UTC)
                : undefined,
              rejectedBy: r.rejectedBy
                ? String(r.rejectedBy)
                : undefined,
              rejectedByName: r.rejectedByName
                ? String(r.rejectedByName)
                : undefined,
              rejectionReason: r.rejectionReason
                ? String(r.rejectionReason)
                : undefined,
              adjustedHours: (r.adjustedHours !== "" && r.adjustedHours !== null && r.adjustedHours !== undefined)
                ? Number(r.adjustedHours)
                : undefined,
            }));

          set({ timesheets });
        }

        // Notifications
        if (data.notifications?.length) {
          const notifications: EmployeeNotification[] = data.notifications
            .filter((r: any) => r.id && r.employeeId)
            .map((r: any) => ({
              id: String(r.id),
              employeeId: String(r.employeeId),
              type: r.type,
              message: String(r.message || ""),
              createdAt: Number(r.createdAt_UTC) || Date.now(),
              read: r.read === "TRUE" || r.read === true,
              timesheetDate: r.timesheetDate
                ? String(r.timesheetDate)
                : undefined,
            }));

          if (notifications.length) set({ notifications });
        }

        // Audit Log
        if (data.auditLog?.length) {
          const auditLog: AuditEntry[] = data.auditLog
            .filter((r: any) => r.id)
            .map((r: any) => ({
              id: String(r.id),
              timestamp: Number(r.timestamp_UTC) || Date.now(),
              type: r.type,
              actorId: String(r.actorId || ""),
              actorName: String(r.actorName || ""),
              subject: String(r.subject || ""),
              action: String(r.action || ""),
            }));

          if (auditLog.length) set({ auditLog });
        }
      },
    }),
    {
      name: "timelog-v2",
      partialize: (state) => ({
        // Auth
        currentEmployeeId: state.currentEmployeeId,
        currentEmail: state.currentEmail,
        isAuthenticated: state.isAuthenticated,
        portal: state.portal,
        // Cache employees so the app renders instantly on reload without
        // waiting for Sheets. Sheets sync will overwrite with fresh data.
        employees: state.employees,
        config: state.config,
      }),
    }
  )
);
