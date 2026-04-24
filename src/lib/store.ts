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
import {
  dbAddEmployee,
  dbUpdateEmployee,
  dbSetConfig,
  dbAddHoliday,
  dbRemoveHoliday,
  dbUpsertTimesheet,
  dbRejectTimesheet,
  dbReverseRejection,
  dbAdjustTimesheet,
  dbDeleteTimesheet,
  dbResetCheckout,
  dbApplyLeave,
  dbCancelLeave,
  dbCreateQuery,
  dbUpdateQuery,
  dbAddNotification,
  dbMarkNotificationsRead,
  dbAddAudit,
} from "./db";

/* ------------------------------------------------------------------ */
/*  Cross-tab sync (same browser, multiple tabs)                       */
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
      } catch { /* ignore */ }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

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
  updateEmployee: (id: string, patch: Partial<Employee>, actorId: string) => void;

  // Holidays
  holidays: Holiday[];
  addHoliday: (h: Omit<Holiday, "id">) => void;
  removeHoliday: (id: string) => void;

  // Timesheets / shifts
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
  applyLeave: (empId: string, date: string, type: LeaveType, note: string) => void;
  cancelLeave: (leaveId: string) => void;
  getLeave: (empId: string, date: string) => LeaveRequest | undefined;

  // Queries
  queries: TimesheetQuery[];
  createQuery: (timesheetId: string, employeeId: string, question: string) => void;
  addQueryMessage: (queryId: string, role: "admin" | "employee", text: string) => void;
  respondQuery: (queryId: string, response: string) => void;
  resolveQuery: (queryId: string) => void;

  // Notifications
  notifications: EmployeeNotification[];
  addNotification: (empId: string, type: NotificationType, message: string, tsDate?: string) => void;
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

  // Supabase sync
  loadFromSupabase: (data: {
    employees: Employee[];
    timesheets: Timesheet[];
    holidays: Holiday[];
    leaves: LeaveRequest[];
    queries: TimesheetQuery[];
    notifications: EmployeeNotification[];
    auditLog: AuditEntry[];
    config: Array<{ key: string; value: string }>;
  }) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fire(p: Promise<any>) {
  p.catch((e) => console.error("[db]", e));
}

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
          currentEmployeeId: employeeId || (role === "admin" ? "admin" : ""),
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
        const newRoles = [...get().config.roles, role];
        set((s) => ({ config: { ...s.config, roles: newRoles } }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added role: "${role}"`);
        fire(dbSetConfig("roles", newRoles.join(",")));
      },
      removeRole: (role) => {
        const newRoles = get().config.roles.filter((r) => r !== role);
        set((s) => ({ config: { ...s.config, roles: newRoles } }));
        get().addAudit("config", get().currentEmployeeId, "System", `Removed role: "${role}"`);
        fire(dbSetConfig("roles", newRoles.join(",")));
      },
      addVertical: (v) => {
        const newV = [...get().config.verticals, v];
        set((s) => ({ config: { ...s.config, verticals: newV } }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added vertical: "${v}"`);
        fire(dbSetConfig("verticals", newV.join(",")));
      },
      removeVertical: (v) => {
        const newV = get().config.verticals.filter((x) => x !== v);
        set((s) => ({
          config: { ...s.config, verticals: newV },
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
        fire(dbSetConfig("verticals", newV.join(",")));
      },

      employees: [],
      addEmployee: (data) => {
        const e: Employee = { ...data, id: uid(), createdAt: Date.now() };
        set((s) => ({ employees: [...s.employees, e] }));
        get().addAudit(
          "onboard",
          get().currentEmployeeId,
          e.name,
          `Onboarded ${e.name} as ${e.role} — verticals: ${e.verticals.join(", ") || "none"}`
        );
        fire(dbAddEmployee(e));
      },
      updateEmployee: (id, patch, actorId) => {
        const old = get().employees.find((e) => e.id === id);
        if (!old) return;
        const diff: AuditEntry["diff"] = [];
        (Object.keys(patch) as (keyof Employee)[]).forEach((k) => {
          const ov = JSON.stringify(old[k]);
          const nv = JSON.stringify(patch[k]);
          if (ov !== nv) diff.push({ field: k, from: String(old[k]), to: String(patch[k]) });
        });
        set((s) => ({
          employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
        if (diff.length) {
          get().addAudit("profile", actorId, old.name, `Profile updated for ${old.name}`, diff);
          fire(dbUpdateEmployee(id, patch));
        }
      },

      holidays: [],
      addHoliday: (h) => {
        const nh: Holiday = { ...h, id: uid() };
        set((s) => ({
          holidays: [...s.holidays, nh].sort((a, b) => a.date.localeCompare(b.date)),
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added holiday: ${h.name} (${h.date})`);
        fire(dbAddHoliday(nh));
      },
      removeHoliday: (id) => {
        const h = get().holidays.find((x) => x.id === id);
        set((s) => ({ holidays: s.holidays.filter((x) => x.id !== id) }));
        if (h) {
          get().addAudit("config", get().currentEmployeeId, "System", `Removed holiday: ${h.name}`);
          fire(dbRemoveHoliday(id));
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
          `Submitted timesheet for ${ts.date} — ${ts.totalHours.toFixed(1)}h across ${ts.entries.length} entr${ts.entries.length === 1 ? "y" : "ies"}: ${ts.entries.map((e) => `${e.vertical} (${e.hours}h)`).join(", ")}`
        );
        fire(dbUpsertTimesheet(ts));
      },
      getTimesheet: (employeeId, date) =>
        get().timesheets.find((t) => t.employeeId === employeeId && t.date === date),
      getShifts: (employeeId, date) =>
        get().timesheets.filter((t) => t.employeeId === employeeId && t.date === date),
      getActiveShift: (employeeId) =>
        get().timesheets.find((t) => t.employeeId === employeeId && t.status === "in-progress"),
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
        get().addAudit("timesheet", employeeId, emp?.name || employeeId, `Clocked in for ${date}`);
        fire(dbUpsertTimesheet(ts));
        return ts.id;
      },
      endWorkday: (tsId, entries) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
        const endedAt = Date.now();
        const capturedHours =
          ts.startedAt
            ? Math.round(Math.max(0, (endedAt - ts.startedAt) / 3600000) * 100) / 100
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
        set((s) => ({ timesheets: s.timesheets.map((t) => (t.id === tsId ? updated : t)) }));
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        const breakdownSum = entries.reduce((a, r) => a + (r.hours || 0), 0);
        const summary = entries.length
          ? `${capturedHours.toFixed(2)}h on the clock · breakdown ${breakdownSum.toFixed(1)}h across ${entries.length} entr${entries.length === 1 ? "y" : "ies"}: ${entries.map((e) => `${e.vertical} (${e.hours}h)`).join(", ")}`
          : `${capturedHours.toFixed(2)}h on the clock · no breakdown entered`;
        get().addAudit(
          "timesheet",
          ts.employeeId,
          emp?.name || ts.employeeId,
          `Clocked out for ${ts.date} — ${summary}`
        );
        fire(dbUpsertTimesheet(updated));
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
        set((s) => ({ timesheets: s.timesheets.map((t) => (t.id === tsId ? updated : t)) }));
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
          `Your shift on ${ts.date} was rejected by ${actorName}${reason ? `: ${reason}` : ""}`,
          ts.date
        );
        fire(dbRejectTimesheet(tsId, reason, actorId, actorName, updated.rejectedAt!));
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
        set((s) => ({ timesheets: s.timesheets.map((t) => (t.id === tsId ? updated : t)) }));
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
        fire(dbReverseRejection(tsId));
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
        const actorName =
          actorId === "admin"
            ? "Admin"
            : get().employees.find((e) => e.id === actorId)?.name || actorId;
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
        fire(dbAdjustTimesheet(tsId, hours));
      },
      resetShift: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
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
          `Reset (full) shift for ${ts.date}`
        );
        get().addNotification(
          ts.employeeId,
          "reset",
          `Your shift record for ${ts.date} was fully reset by ${actorName} — please re-log your hours`,
          ts.date
        );
        fire(dbDeleteTimesheet(tsId));
      },
      resetCheckin: (tsId) => {
        const ts = get().timesheets.find((t) => t.id === tsId);
        if (!ts) return;
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
        fire(dbDeleteTimesheet(tsId));
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
        set((s) => ({ timesheets: s.timesheets.map((t) => (t.id === tsId ? updated : t)) }));
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
        fire(dbResetCheckout(tsId));
      },
      adminAddTimeLog: (empId, date, checkinMs, checkoutMs, entries) => {
        const capturedHours =
          Math.round(Math.max(0, (checkoutMs - checkinMs) / 3600000) * 100) / 100;
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
          `Admin manually added time log for ${date} — ${capturedHours.toFixed(2)}h`
        );
        fire(dbUpsertTimesheet(ts));
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
            ...s.leaves.filter((l) => !(l.employeeId === empId && l.date === date)),
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
        fire(dbApplyLeave(leave));
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
          fire(dbCancelLeave(leaveId));
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
          `${actorName} has a question about your shift${ts?.date ? ` on ${ts.date}` : ""}: "${question}"`,
          ts?.date
        );
        fire(dbCreateQuery(q));
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
        const updatedMessages = [
          ...(q.messages || [
            {
              id: uid(),
              role: "admin" as const,
              actorName: q.byActorName,
              text: q.question,
              createdAt: q.createdAt,
            },
          ]),
          msg,
        ];
        const updated: TimesheetQuery = {
          ...q,
          messages: updatedMessages,
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
            `${emp?.name || "Employee"} replied to your query${q.question ? ` "${q.question.slice(0, 40)}${q.question.length > 40 ? "…" : ""}"` : ""}`,
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
        fire(
          dbUpdateQuery(queryId, {
            messages: updatedMessages,
            response: updated.response,
            responded_at: updated.respondedAt,
          })
        );
      },
      respondQuery: (queryId, response) => {
        get().addQueryMessage(queryId, "employee", response);
      },
      resolveQuery: (queryId) => {
        const q = get().queries.find((x) => x.id === queryId);
        if (!q) return;
        const resolvedAt = Date.now();
        const updated: TimesheetQuery = { ...q, status: "resolved", resolvedAt };
        set((s) => ({ queries: s.queries.map((x) => (x.id === queryId ? updated : x)) }));
        const actorId = get().currentEmployeeId;
        const emp = get().employees.find((e) => e.id === q.employeeId);
        get().addAudit(
          "query",
          actorId,
          emp?.name || q.employeeId,
          `Resolved query on ${emp?.name || q.employeeId}'s timesheet`
        );
        fire(dbUpdateQuery(queryId, { status: "resolved", resolved_at: resolvedAt }));
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
        fire(dbAddNotification(n));
      },
      markNotificationsRead: (empId) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.employeeId === empId ? { ...n, read: true } : n
          ),
        }));
        fire(dbMarkNotificationsRead(empId));
      },

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
        fire(dbAddAudit(entry));
      },

      loadFromSupabase: (data) => {
        if (data.employees.length) set({ employees: data.employees });
        if (data.timesheets.length) set({ timesheets: data.timesheets });
        if (data.holidays.length) set({ holidays: data.holidays });
        set({ leaves: data.leaves });
        if (data.queries.length) set({ queries: data.queries });
        if (data.notifications.length) set({ notifications: data.notifications });
        if (data.auditLog.length) set({ auditLog: data.auditLog });

        // Merge config
        const configMap: Record<string, string> = {};
        data.config.forEach((r) => { configMap[r.key] = r.value; });
        const updates: Partial<OrgConfig> = {};
        if (configMap.roles)
          updates.roles = configMap.roles.split(",").map((s) => s.trim()).filter(Boolean);
        if (configMap.verticals)
          updates.verticals = configMap.verticals.split(",").map((s) => s.trim()).filter(Boolean);
        if (Object.keys(updates).length)
          set((s) => ({ config: { ...s.config, ...updates } }));
      },
    }),
    {
      name: "timelog-v2",
      partialize: (state) => ({
        currentEmployeeId: state.currentEmployeeId,
        currentEmail: state.currentEmail,
        isAuthenticated: state.isAuthenticated,
        portal: state.portal,
        employees: state.employees,
        config: state.config,
      }),
    }
  )
);
