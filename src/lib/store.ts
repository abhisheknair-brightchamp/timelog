// src/lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Employee,
  Holiday,
  Timesheet,
  TimesheetEntry,
  TimesheetQuery,
  LeaveRequest,
  LeaveType,
  AuditEntry,
  OrgConfig,
  Portal,
  AuditType,
} from "@/types";

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

  // Timesheets
  timesheets: Timesheet[];
  submitTimesheet: (ts: Omit<Timesheet, "id">) => void;
  getTimesheet: (employeeId: string, date: string) => Timesheet | undefined;
  startWorkday: (employeeId: string, date: string, tz: string) => string;
  endWorkday: (tsId: string, entries: TimesheetEntry[]) => void;

  // Leaves
  leaves: LeaveRequest[];
  applyLeave: (empId: string, date: string, type: LeaveType, note: string) => void;
  cancelLeave: (leaveId: string) => void;
  getLeave: (empId: string, date: string) => LeaveRequest | undefined;

  // Queries
  queries: TimesheetQuery[];
  createQuery: (timesheetId: string, employeeId: string, question: string) => void;
  respondQuery: (queryId: string, response: string) => void;
  resolveQuery: (queryId: string) => void;

  // Audit
  auditLog: AuditEntry[];
  addAudit: (type: AuditType, actorId: string, subject: string, action: string, diff?: AuditEntry["diff"]) => void;

  // Sheets sync
  loadFromSheets: (data: any) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function sheetsPost(url: string, action: string, data: any) {
  if (!url) return;
  fetch(url, {
    method: "POST",
    body: JSON.stringify({ action, data }),
  }).catch(() => {});
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
        sheetsPost(get().config.sheetsUrl, "addRole", { role });
      },
      removeRole: (role) => {
        set((s) => ({
          config: { ...s.config, roles: s.config.roles.filter((r) => r !== role) },
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Removed role: "${role}"`);
        sheetsPost(get().config.sheetsUrl, "removeRole", { role });
      },
      addVertical: (v) => {
        set((s) => ({
          config: { ...s.config, verticals: [...s.config.verticals, v] },
        }));
        get().addAudit("config", get().currentEmployeeId, "System", `Added vertical: "${v}"`);
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
        get().addAudit("config", get().currentEmployeeId, "System", `Removed vertical: "${v}" — unassigned from all employees`);
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
          `Onboarded ${e.name} as ${e.role} — verticals: ${e.verticals.join(", ") || "none"}`
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
            diff.push({ field: k, from: String(old[k]), to: String(patch[k]) });
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
        get().addAudit("config", get().currentEmployeeId, "System", `Added holiday: ${h.name} (${h.date})`);
        sheetsPost(get().config.sheetsUrl, "addHoliday", nh);
      },
      removeHoliday: (id) => {
        const h = get().holidays.find((x) => x.id === id);
        set((s) => ({ holidays: s.holidays.filter((x) => x.id !== id) }));
        if (h) {
          get().addAudit("config", get().currentEmployeeId, "System", `Removed holiday: ${h.name}`);
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
          `Submitted timesheet for ${ts.date} — ${ts.totalHours.toFixed(1)}h across ${ts.entries.length} entr${ts.entries.length === 1 ? "y" : "ies"}: ${ts.entries.map((e) => `${e.vertical} (${e.hours}h)`).join(", ")}`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", ts);
      },
      getTimesheet: (employeeId, date) =>
        get().timesheets.find(
          (t) => t.employeeId === employeeId && t.date === date
        ),
      startWorkday: (employeeId, date, tz) => {
        const existing = get().timesheets.find(
          (t) => t.employeeId === employeeId && t.date === date
        );
        if (existing) return existing.id;
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
        const totalHours = entries.reduce((a, r) => a + (r.hours || 0), 0);
        const endedAt = Date.now();
        const capturedHours = ts.startedAt
          ? Math.round(((endedAt - ts.startedAt) / 3600000) * 100) / 100
          : 0;
        const updated: Timesheet = {
          ...ts,
          entries,
          totalHours,
          capturedHours,
          endedAt,
          submitted: true,
          submittedAt: endedAt,
          status: "submitted",
        };
        set((s) => ({
          timesheets: s.timesheets.map((t) => (t.id === tsId ? updated : t)),
        }));
        const emp = get().employees.find((e) => e.id === ts.employeeId);
        const summary = entries.length
          ? `${totalHours.toFixed(1)}h logged / ${capturedHours.toFixed(2)}h captured across ${entries.length} entr${entries.length === 1 ? "y" : "ies"}: ${entries.map((e) => `${e.vertical} (${e.hours}h)`).join(", ")}`
          : `no work logged / ${capturedHours.toFixed(2)}h captured`;
        get().addAudit(
          "timesheet",
          ts.employeeId,
          emp?.name || ts.employeeId,
          `Clocked out for ${ts.date} — ${summary}`
        );
        sheetsPost(get().config.sheetsUrl, "submitTimesheet", updated);
      },

      leaves: [],
      applyLeave: (empId, date, type, note) => {
        const leave: LeaveRequest = { id: uid(), employeeId: empId, date, type, note, appliedAt: Date.now() };
        set((s) => ({ leaves: [...s.leaves.filter((l) => !(l.employeeId === empId && l.date === date)), leave] }));
        const emp = get().employees.find((e) => e.id === empId);
        get().addAudit("profile", empId, emp?.name || empId, `Applied ${type} leave for ${date}${note ? `: ${note}` : ""}`);
        sheetsPost(get().config.sheetsUrl, "applyLeave", leave);
      },
      cancelLeave: (leaveId) => {
        const leave = get().leaves.find((l) => l.id === leaveId);
        set((s) => ({ leaves: s.leaves.filter((l) => l.id !== leaveId) }));
        if (leave) {
          get().addAudit("profile", leave.employeeId, leave.employeeId, `Cancelled ${leave.type} leave for ${leave.date}`);
          sheetsPost(get().config.sheetsUrl, "cancelLeave", { id: leaveId });
        }
      },
      getLeave: (empId, date) => get().leaves.find((l) => l.employeeId === empId && l.date === date),

      queries: [],
      createQuery: (timesheetId, employeeId, question) => {
        const actorId = get().currentEmployeeId;
        const actorName = actorId === "admin" ? "Admin" : (get().employees.find((e) => e.id === actorId)?.name || actorId);
        const q: TimesheetQuery = {
          id: uid(),
          timesheetId,
          employeeId,
          byActorId: actorId,
          byActorName: actorName,
          question,
          status: "open",
          createdAt: Date.now(),
        };
        set((s) => ({ queries: [q, ...s.queries] }));
        const emp = get().employees.find((e) => e.id === employeeId);
        get().addAudit("query", actorId, emp?.name || employeeId, `Raised query on ${emp?.name || employeeId}'s timesheet: "${question}"`);
        sheetsPost(get().config.sheetsUrl, "createQuery", q);
      },
      respondQuery: (queryId, response) => {
        const q = get().queries.find((x) => x.id === queryId);
        if (!q) return;
        const updated: TimesheetQuery = { ...q, response, respondedAt: Date.now() };
        set((s) => ({ queries: s.queries.map((x) => (x.id === queryId ? updated : x)) }));
        const emp = get().employees.find((e) => e.id === q.employeeId);
        get().addAudit("query", q.employeeId, emp?.name || q.employeeId, `Responded to query: "${response}"`);
        sheetsPost(get().config.sheetsUrl, "respondQuery", { id: queryId, response, respondedAt: updated.respondedAt });
      },
      resolveQuery: (queryId) => {
        const q = get().queries.find((x) => x.id === queryId);
        if (!q) return;
        const updated: TimesheetQuery = { ...q, status: "resolved", resolvedAt: Date.now() };
        set((s) => ({ queries: s.queries.map((x) => (x.id === queryId ? updated : x)) }));
        const actorId = get().currentEmployeeId;
        const emp = get().employees.find((e) => e.id === q.employeeId);
        get().addAudit("query", actorId, emp?.name || q.employeeId, `Resolved query on ${emp?.name || q.employeeId}'s timesheet`);
        sheetsPost(get().config.sheetsUrl, "resolveQuery", { id: queryId, resolvedAt: updated.resolvedAt });
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
        sheetsPost(get().config.sheetsUrl, "addAudit", entry);
      },

      loadFromSheets: (data: any) => {
        // Parse employees from Sheets format
        if (data.employees?.length) {
          const employees: Employee[] = data.employees
            .filter((r: any) => r.id && r.email)
            .map((r: any) => ({
              id: String(r.id),
              name: String(r.name || ""),
              email: String(r.email || ""),
              role: String(r.role || ""),
              verticals: r.verticals ? String(r.verticals).split(",").map((v: string) => v.trim()).filter(Boolean) : [],
              timezone: String(r.timezone || "Asia/Kolkata"),
              weekoffs: r.weekoffs ? String(r.weekoffs).split(",").map(Number).filter((n: number) => !isNaN(n)) : [],
              minHoursPerDay: Number(r.minHoursPerDay) || 8,
              active: r.active !== "FALSE",
              createdAt: Number(r.createdAt_UTC) || Date.now(),
            }));
          if (employees.length) set({ employees });
        }

        // Parse holidays
        if (data.holidays?.length) {
          const holidays: Holiday[] = data.holidays
            .filter((r: any) => r.id && r.date)
            .map((r: any) => ({ id: String(r.id), date: String(r.date), name: String(r.name || "") }));
          if (holidays.length) set({ holidays });
        }

        // Parse leaves
        if (data.leaves?.length) {
          const leaves: LeaveRequest[] = data.leaves
            .filter((r: any) => r.id && r.employeeId)
            .map((r: any) => ({
              id: String(r.id),
              employeeId: String(r.employeeId),
              date: String(r.date),
              type: (r.type || "other") as LeaveType,
              note: String(r.note || ""),
              appliedAt: Number(r.appliedAt_UTC) || Date.now(),
            }));
          if (leaves.length) set({ leaves });
        }

        // Parse queries
        if (data.queries?.length) {
          const queries: TimesheetQuery[] = data.queries
            .filter((r: any) => r.id && r.timesheetId)
            .map((r: any) => ({
              id: String(r.id),
              timesheetId: String(r.timesheetId),
              employeeId: String(r.employeeId),
              byActorId: String(r.byActorId),
              byActorName: String(r.byActorName || ""),
              question: String(r.question || ""),
              response: r.response ? String(r.response) : undefined,
              status: (r.status === "resolved" ? "resolved" : "open") as "open" | "resolved",
              createdAt: Number(r.createdAt_UTC) || Date.now(),
              respondedAt: r.respondedAt_UTC ? Number(r.respondedAt_UTC) : undefined,
              resolvedAt: r.resolvedAt_UTC ? Number(r.resolvedAt_UTC) : undefined,
            }));
          if (queries.length) set({ queries });
        }

        // Parse config
        if (data.config?.length) {
          const configMap: Record<string, string> = {};
          data.config.forEach((r: any) => { if (r.key) configMap[r.key] = String(r.value || ""); });
          const updates: Partial<OrgConfig> = {};
          if (configMap.roles) updates.roles = configMap.roles.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (configMap.verticals) updates.verticals = configMap.verticals.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (Object.keys(updates).length) set((s) => ({ config: { ...s.config, ...updates } }));
        }
      },
    }),
    { name: "timelog-v1" }
  )
);
