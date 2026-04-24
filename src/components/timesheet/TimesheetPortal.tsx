"use client";
// src/components/timesheet/TimesheetPortal.tsx
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import {
  PageShell, SectionLabel, Card, Button, InfoBanner,
  Chip, showToast, Toast,
} from "@/components/ui";
import {
  getDayStatus, TIMEZONES, fmtIST, getShiftHours, sumShiftHours,
} from "@/lib/utils";
import type { DayStatus, TimesheetEntry, LeaveType, Timesheet } from "@/types";

const LEAVE_TYPES: { id: LeaveType; label: string; color: string; bg: string }[] = [
  { id: "sick",   label: "Sick leave",   color: "#A32D2D", bg: "#FCEBEB" },
  { id: "annual", label: "Annual leave", color: "#185FA5", bg: "#E6F1FB" },
  { id: "other",  label: "Other",        color: "#5F5E5A", bg: "#F1EFE8" },
];

export default function TimesheetPortal() {
  const [page, setPage] = useState("log");

  useEffect(() => {
    const handler = (e: Event) => setPage((e as CustomEvent).detail);
    window.addEventListener("tl:page", handler);
    return () => window.removeEventListener("tl:page", handler);
  }, []);

  return (
    <>
      {page === "log"     && <LogToday />}
      {page === "history" && <MyHistory />}
      {page === "leaves"  && <MyLeaves />}
      <Toast />
    </>
  );
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function fmtClock(utcMs: number, iana: string): string {
  return new Date(utcMs).toLocaleTimeString("en-US", {
    timeZone: iana,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Log Today — multi-shift punch in/out ────────────────────────────────────
function LogToday() {
  const { employees, holidays, timesheets, leaves, config, getShifts, getLeave, applyLeave, startWorkday, endWorkday, currentEmployeeId } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves, config: s.config,
    getShifts: s.getShifts, getLeave: s.getLeave, applyLeave: s.applyLeave,
    startWorkday: s.startWorkday, endWorkday: s.endWorkday,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId);
  const todayLocal = emp
    ? new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone })
    : new Date().toLocaleDateString("en-CA");

  const todayShifts = emp
    ? getShifts(currentEmployeeId, todayLocal).slice().sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
    : [];
  const activeShift = todayShifts.find((t) => t.status === "in-progress");

  // Live clock — updates while on the clock
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!activeShift) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeShift]);

  // Entry form state for the in-progress shift's breakdown (reset whenever a new shift starts)
  const [rows, setRows] = useState<TimesheetEntry[]>([
    { vertical: config.verticals[0] || "", note: "", hours: 0 },
  ]);
  useEffect(() => {
    // Reset the breakdown when we move into a brand new active shift
    setRows([{ vertical: config.verticals[0] || "", note: "", hours: 0 }]);
  }, [activeShift?.id, config.verticals]);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [leaveNote, setLeaveNote] = useState("");

  if (!emp) return <div style={{ padding: 32, color: "var(--c-text-3)", fontSize: 13 }}>Loading…</div>;
  const tz = TIMEZONES.find((t) => t.iana === emp.timezone) || TIMEZONES[0];

  const status: DayStatus = getDayStatus(emp, todayLocal, holidays, timesheets, todayLocal, leaves);
  const completedShifts = todayShifts.filter((t) => t.status !== "in-progress");
  const leave = getLeave(currentEmployeeId, todayLocal);
  const holiday = holidays.find((h) => h.date === todayLocal);

  function addRow() { setRows((r) => [...r, { vertical: config.verticals[0] || "", note: "", hours: 0 }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, patch: Partial<TimesheetEntry>) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  function onClockIn() {
    if (!emp) return;
    startWorkday(currentEmployeeId, todayLocal, emp.timezone);
    showToast("Clocked in — have a productive session");
  }

  function onClockOut() {
    if (!activeShift) return;
    // Only rows with hours entered count as real entries — pre-filled dropdowns alone don't.
    const filled = rows.filter((r) => (r.hours || 0) > 0);
    for (const row of filled) {
      if (!row.vertical) { showToast("Vertical is required for filled entries"); return; }
    }
    const capturedMs = activeShift.startedAt ? Date.now() - activeShift.startedAt : 0;
    const capturedHrs = capturedMs / 3600000;
    endWorkday(activeShift.id, filled);
    showToast(`Clocked out — ${capturedHrs.toFixed(2)}h captured`);
  }

  function submitLeave() {
    applyLeave(currentEmployeeId, todayLocal, leaveType, leaveNote);
    setShowLeaveForm(false);
    showToast("Leave applied");
  }

  const dayLabel = new Date(todayLocal + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const elapsedMs = activeShift?.startedAt ? now - activeShift.startedAt : 0;
  const totalToday = sumShiftHours(todayShifts);

  return (
    <PageShell title="Log today" subtitle={`${emp.name} · ${tz.short} · ${dayLabel}`}>

      {status === "weekoff" && (
        <div style={{ background: "#F1EFE8", borderRadius: "var(--r-lg)", padding: "24px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏖</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#5F5E5A" }}>Today is your week off</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>Enjoy your day — no logging required</div>
        </div>
      )}

      {status === "holiday" && (
        <div style={{ background: "#FAEEDA", borderRadius: "var(--r-lg)", padding: "24px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#854F0B" }}>Public holiday — {holiday?.name}</div>
          <div style={{ fontSize: 12, color: "#BA7517", marginTop: 4 }}>No logging required today</div>
        </div>
      )}

      {status === "leave" && leave && (
        <div style={{ background: "#FCEBEB", borderRadius: "var(--r-lg)", padding: "24px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤒</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D" }}>
            {LEAVE_TYPES.find((t) => t.id === leave.type)?.label} applied
          </div>
          {leave.note && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 4, opacity: 0.7 }}>{leave.note}</div>}
        </div>
      )}

      {status !== "weekoff" && status !== "holiday" && status !== "leave" && (
        <>
          {/* Summary banner */}
          {todayShifts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--c-bg)", padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 14, fontSize: 12 }}>
              <span style={{ color: "var(--c-text-2)" }}>
                {todayShifts.length} shift{todayShifts.length === 1 ? "" : "s"} today · target {emp.minHoursPerDay}h
              </span>
              <span style={{ fontWeight: 500, color: "var(--c-brand-dark)" }}>{totalToday.toFixed(2)}h captured</span>
            </div>
          )}

          {/* Active shift — timer + clock-out form */}
          {activeShift && (
            <>
              <Card highlight>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>On the clock</div>
                    <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>
                      Started at <strong>{activeShift.startedAt ? fmtClock(activeShift.startedAt, emp.timezone) : ""}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 500, color: "var(--c-brand-dark)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtElapsed(elapsedMs)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--c-text-3)" }}>elapsed</div>
                  </div>
                </div>
              </Card>

              <InfoBanner>
                Breakdown below is just for context — hours logged are the actual elapsed time between clock-in and clock-out. You can clock out any time and start another shift later.
              </InfoBanner>

              <Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8 }}>
                  {["Vertical", "What did you work on?", "Hours", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 500, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>

                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <select value={row.vertical} onChange={(e) => updateRow(ri, { vertical: e.target.value })}>
                      {config.verticals.map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <input type="text" value={row.note} placeholder="Brief description…" onChange={(e) => updateRow(ri, { note: e.target.value })} />
                    <input type="number" value={row.hours || ""} placeholder="0" min={0.25} max={14} step={0.25} onChange={(e) => updateRow(ri, { hours: parseFloat(e.target.value) || 0 })} />
                    {rows.length > 1
                      ? <button onClick={() => removeRow(ri)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-text-3)", padding: 0, lineHeight: 1 }}>×</button>
                      : <span />}
                  </div>
                ))}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "0.5px solid var(--c-border)", marginTop: 4 }}>
                  <Button size="xs" onClick={addRow}>+ Add row</Button>
                  <Button variant="primary" size="sm" onClick={onClockOut}>■ Clock out</Button>
                </div>
              </Card>
            </>
          )}

          {/* Clock-in CTA when no active shift */}
          {!activeShift && (
            <Card highlight>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 6 }}>
                  {todayShifts.length === 0 ? "Ready to start your day?" : "Start another shift?"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>
                  {todayShifts.length === 0 ? "Clock in to begin" : "You're off the clock"}
                </div>
                <Button variant="primary" onClick={onClockIn}>▶ Clock in</Button>
                {todayShifts.length === 0 && (
                  <div style={{ marginTop: 16, fontSize: 11, color: "var(--c-text-3)" }}>
                    Or{" "}
                    <button onClick={() => setShowLeaveForm(true)} style={{ background: "none", border: "none", color: "var(--c-brand-dark)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
                      apply leave for today
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Today's completed shifts */}
          {completedShifts.length > 0 && (
            <>
              <SectionLabel>Completed shifts today</SectionLabel>
              {completedShifts.map((s) => <ShiftCard key={s.id} ts={s} tz={emp.timezone} />)}
            </>
          )}

          {/* Leave application form */}
          {showLeaveForm && !activeShift && todayShifts.length === 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Apply leave for today</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {LEAVE_TYPES.map((lt) => (
                  <button key={lt.id} onClick={() => setLeaveType(lt.id)} style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 999,
                    border: `0.5px solid ${leaveType === lt.id ? lt.color : "var(--c-border-strong)"}`,
                    background: leaveType === lt.id ? lt.bg : "var(--c-bg)",
                    color: leaveType === lt.id ? lt.color : "var(--c-text-2)",
                    cursor: "pointer", fontFamily: "var(--font-body)",
                  }}>
                    {lt.label}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Reason (optional)</label>
                <input type="text" value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="e.g. Fever, family emergency…" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" size="sm" onClick={submitLeave}>Confirm leave</Button>
                <Button size="sm" onClick={() => setShowLeaveForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

function ShiftCard({ ts, tz }: { ts: Timesheet; tz: string }) {
  const hrs = getShiftHours(ts);
  const rejected = ts.status === "rejected";
  return (
    <div style={{
      border: `0.5px solid ${rejected ? "#F09595" : "var(--c-border)"}`,
      borderRadius: "var(--r-lg)", padding: 14, marginBottom: 8,
      background: rejected ? "#FEF6F6" : "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>
          {ts.startedAt ? fmtClock(ts.startedAt, tz) : "—"} → {ts.endedAt ? fmtClock(ts.endedAt, tz) : "—"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: rejected ? "#A32D2D" : "var(--c-brand-dark)" }}>
            {hrs.toFixed(2)}h
          </span>
          {rejected
            ? <Chip label="Rejected" variant="red" />
            : <Chip label="Submitted" variant="green" />}
        </div>
      </div>
      {rejected && ts.rejectionReason && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 8, paddingLeft: 8, borderLeft: "2px solid #A32D2D" }}>
          <strong>Rejected:</strong> {ts.rejectionReason}
          {ts.rejectedByName && <span style={{ opacity: 0.7 }}> · {ts.rejectedByName}</span>}
        </div>
      )}
      {ts.entries.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--c-text-3)" }}>No breakdown logged</div>
      )}
      {ts.entries.map((en, i) => (
        <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", alignItems: "center" }}>
          <Chip label={en.vertical} variant="purple" tiny />
          <span style={{ flex: 1, fontSize: 12, color: "var(--c-text-2)" }}>{en.note || "—"}</span>
          <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{en.hours.toFixed(2)}h</span>
        </div>
      ))}
    </div>
  );
}

// ─── My History — shifts grouped by date + admin queries ──────────────────────
function MyHistory() {
  const { employees, holidays, timesheets, leaves, queries, notifications, currentEmployeeId, addQueryMessage, markNotificationsRead } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves, queries: s.queries,
    notifications: s.notifications,
    currentEmployeeId: s.currentEmployeeId,
    addQueryMessage: s.addQueryMessage,
    markNotificationsRead: s.markNotificationsRead,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId)!;
  if (!emp) return <div style={{ padding: 32, color: "var(--c-text-3)", fontSize: 13 }}>Loading…</div>;
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });

  // Group my completed shifts by date
  const myShifts = timesheets.filter((t) => t.employeeId === currentEmployeeId && (t.status === "submitted" || t.status === "rejected"));
  const shiftsByDate: Record<string, Timesheet[]> = {};
  myShifts.forEach((t) => {
    (shiftsByDate[t.date] = shiftsByDate[t.date] || []).push(t);
  });
  const datesDesc = Object.keys(shiftsByDate).sort((a, b) => b.localeCompare(a));

  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  type StatusStyle = { bg: string; color: string };
  const STATUS_STYLES: Record<DayStatus, StatusStyle> = {
    logged:        { bg: "#E6F1FB", color: "#185FA5" },
    missing:       { bg: "#FCEBEB", color: "#A32D2D" },
    weekoff:       { bg: "#F1EFE8", color: "#5F5E5A" },
    holiday:       { bg: "#FAEEDA", color: "#854F0B" },
    upcoming:      { bg: "#fff",    color: "var(--c-text-2)" },
    future:        { bg: "#fff",    color: "var(--c-text-3)" },
    leave:         { bg: "#FCEBEB", color: "#A32D2D" },
    "in-progress": { bg: "#EEEDFE", color: "#3C3489" },
  };

  const acceptedShifts = myShifts.filter((t) => t.status !== "rejected");
  const totalHours = sumShiftHours(acceptedShifts);

  const myNotifications = notifications
    .filter((n) => n.employeeId === currentEmployeeId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);
  const unreadNotifications = myNotifications.filter((n) => !n.read);

  const myQueries = queries.filter((q) => q.employeeId === currentEmployeeId);
  const openQueries = myQueries.filter((q) => q.status === "open");

  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function submitReply(queryId: string) {
    if (!replyText.trim()) { showToast("Enter a response"); return; }
    addQueryMessage(queryId, "employee", replyText.trim());
    setReplyFor(null);
    setReplyText("");
    showToast("Reply sent");
  }

  const notifColors: Record<string, { bg: string; color: string; label: string }> = {
    query:   { bg: "#FAEEDA", color: "#854F0B", label: "Question" },
    reject:  { bg: "#FCEBEB", color: "#A32D2D", label: "Rejected" },
    reset:   { bg: "#EEEDFE", color: "#3C3489", label: "Reset" },
    reverse: { bg: "#E1F5EE", color: "#0F6E56", label: "Reinstated" },
  };

  return (
    <PageShell title="My history" subtitle="Monthly overview, submitted shifts, and admin queries">

      {myNotifications.length > 0 && (
        <>
          <SectionLabel mt={0}>
            Notifications
            {unreadNotifications.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 600, padding: "1px 7px",
                borderRadius: 999, background: "#A32D2D", color: "#fff",
              }}>
                {unreadNotifications.length} new
              </span>
            )}
            {unreadNotifications.length > 0 && (
              <button
                onClick={() => markNotificationsRead(currentEmployeeId)}
                style={{ marginLeft: 10, fontSize: 9, color: "var(--c-brand)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
          </SectionLabel>
          <Card>
            {myNotifications.map((n) => {
              const nc = notifColors[n.type] || notifColors.query;
              return (
                <div key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 0", borderBottom: "0.5px solid var(--c-border)",
                  opacity: n.read ? 0.55 : 1,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
                    background: nc.bg, color: nc.color, marginTop: 1,
                  }}>
                    {nc.label}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--c-text)", lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 3 }}>
                      {new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </div>
                  </div>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#A32D2D", flexShrink: 0, marginTop: 4 }} />}
                </div>
              );
            })}
          </Card>
        </>
      )}

      {openQueries.length > 0 && (
        <>
          <SectionLabel mt={0}>Open queries from admin ({openQueries.length})</SectionLabel>
          {openQueries.map((q) => {
            const relatedTs = timesheets.find((t) => t.id === q.timesheetId);
            const messages = q.messages?.length
              ? q.messages
              : [{ id: q.id, role: "admin" as const, actorName: q.byActorName, text: q.question, createdAt: q.createdAt }];
            const isReplying = replyFor === q.id;
            return (
              <Card key={q.id} highlight>
                <div style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 10 }}>
                  {q.byActorName} · {fmtIST(q.createdAt)}
                  {relatedTs && ` · re: ${relatedTs.date}`}
                </div>

                {/* Thread */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {messages.map((msg) => {
                    const isAdmin = msg.role === "admin";
                    return (
                      <div key={msg.id} style={{
                        alignSelf: isAdmin ? "flex-start" : "flex-end",
                        maxWidth: "85%",
                        background: isAdmin ? "var(--c-bg)" : "var(--c-brand-light)",
                        border: `0.5px solid ${isAdmin ? "var(--c-border)" : "var(--c-brand-border)"}`,
                        borderRadius: "var(--r-md)",
                        padding: "8px 12px",
                      }}>
                        <div style={{ fontSize: 10, color: "var(--c-text-3)", marginBottom: 3 }}>
                          {msg.actorName} · {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--c-text)" }}>{msg.text}</div>
                      </div>
                    );
                  })}
                </div>

                {isReplying ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Your reply…"
                      autoFocus
                      style={{ flex: 1, minHeight: 60, padding: 8, fontSize: 12, border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)", fontFamily: "inherit", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Button variant="primary" size="sm" onClick={() => submitReply(q.id)}>Send</Button>
                      <Button size="sm" onClick={() => { setReplyFor(null); setReplyText(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => { setReplyFor(q.id); setReplyText(""); }}>↩ Reply</Button>
                )}
              </Card>
            );
          })}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20, marginTop: openQueries.length > 0 ? 20 : 0 }}>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--c-brand-dark)" }}>{totalHours.toFixed(1)}h</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Total hours (accepted)</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{datesDesc.length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Days with shifts</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{leaves.filter((l) => l.employeeId === currentEmployeeId).length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Leaves taken</div>
        </div>
      </div>

      <SectionLabel mt={0}>{monthLabel}</SectionLabel>

      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {(["logged", "missing", "weekoff", "holiday", "leave"] as DayStatus[]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--c-text-2)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_STYLES[s].bg, border: "0.5px solid var(--c-border)" }} />
            {s === "leave" ? "Leave" : s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} style={{ fontSize: 10, color: "var(--c-text-3)", textAlign: "center", paddingBottom: 6, fontWeight: 500 }}>{d}</div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const status = getDayStatus(emp, ds, holidays, timesheets, todayLocal, leaves);
            const sc = STATUS_STYLES[status];
            const isToday = ds === todayLocal;
            return (
              <div key={d} title={ds} style={{
                fontSize: 11, textAlign: "center", padding: "5px 2px",
                borderRadius: "var(--r-sm)", background: sc.bg, color: sc.color,
                minHeight: 26, display: "flex", alignItems: "center", justifyContent: "center",
                outline: isToday ? "1.5px solid var(--c-brand)" : "none", outlineOffset: -1,
              }}>{d}</div>
            );
          })}
        </div>
      </Card>

      {datesDesc.length > 0 && (
        <>
          <SectionLabel>Submitted shifts</SectionLabel>
          {datesDesc.map((date) => {
            const shifts = shiftsByDate[date].slice().sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
            const acceptedH = sumShiftHours(shifts.filter((t) => t.status !== "rejected"));
            const rejected = shifts.filter((t) => t.status === "rejected");
            const dl = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
            const dateQueries = myQueries.filter((q) => shifts.some((t) => t.id === q.timesheetId));
            return (
              <div key={date} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{dl}</span>
                  <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                    · {shifts.length} shift{shifts.length === 1 ? "" : "s"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-brand-dark)" }}>
                    {acceptedH.toFixed(2)}h
                  </span>
                  {rejected.length > 0 && <Chip label={`${rejected.length} rejected`} variant="red" tiny />}
                  {dateQueries.length > 0 && <Chip label={`${dateQueries.length} query${dateQueries.length === 1 ? "" : "ies"}`} variant="amber" tiny />}
                </div>
                {shifts.map((s) => <ShiftCard key={s.id} ts={s} tz={emp.timezone} />)}
                {dateQueries.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {dateQueries.map((q) => {
                      const messages = q.messages?.length
                        ? q.messages
                        : [{ id: q.id, role: "admin" as const, actorName: q.byActorName, text: q.question, createdAt: q.createdAt }];
                      return (
                        <div key={q.id} style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: 10, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 600, textTransform: "uppercase" }}>Query</span>
                            {q.status === "resolved" && <Chip label="Resolved" variant="green" tiny />}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {messages.map((msg) => {
                              const isAdmin = msg.role === "admin";
                              return (
                                <div key={msg.id} style={{
                                  alignSelf: isAdmin ? "flex-start" : "flex-end",
                                  maxWidth: "90%",
                                  background: isAdmin ? "#fff" : "var(--c-brand-light)",
                                  border: `0.5px solid ${isAdmin ? "var(--c-border)" : "var(--c-brand-border)"}`,
                                  borderRadius: "var(--r-sm)", padding: "6px 10px",
                                }}>
                                  <div style={{ fontSize: 9, color: "var(--c-text-3)", marginBottom: 2 }}>{msg.actorName}</div>
                                  <div style={{ fontSize: 11, color: "var(--c-text)" }}>{msg.text}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </PageShell>
  );
}

// ─── My Leaves (unchanged) ────────────────────────────────────────────────────
function MyLeaves() {
  const { employees, leaves, applyLeave, cancelLeave, holidays, timesheets, currentEmployeeId } = useStore((s) => ({
    employees: s.employees, leaves: s.leaves,
    applyLeave: s.applyLeave, cancelLeave: s.cancelLeave,
    holidays: s.holidays, timesheets: s.timesheets,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId)!;
  if (!emp) return <div style={{ padding: 32, color: "var(--c-text-3)", fontSize: 13 }}>Loading…</div>;
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });
  const myLeaves = leaves.filter((l) => l.employeeId === currentEmployeeId).sort((a, b) => b.date.localeCompare(a.date));

  const [date, setDate] = useState("");
  const [type, setType] = useState<LeaveType>("annual");
  const [note, setNote] = useState("");

  function applyNew() {
    if (!date) { showToast("Please select a date"); return; }
    if (date <= todayLocal) { showToast("You can only apply leave for future dates — use Log Today for today"); return; }
    const status = getDayStatus(emp, date, holidays, timesheets, todayLocal, leaves);
    if (status === "weekoff") { showToast("That day is already your week off"); return; }
    if (status === "holiday") { showToast("That day is a public holiday"); return; }
    if (status === "leave")   { showToast("Leave already applied for that date"); return; }
    applyLeave(currentEmployeeId, date, type, note);
    setDate(""); setNote("");
    showToast("Leave applied for " + date);
  }

  const sickCount = myLeaves.filter((l) => l.type === "sick").length;
  const annualCount = myLeaves.filter((l) => l.type === "annual").length;

  return (
    <PageShell title="My leaves" subtitle="Apply and manage your leave requests">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#FCEBEB", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#A32D2D" }}>{sickCount}</div>
          <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 2, opacity: 0.7 }}>Sick leaves</div>
        </div>
        <div style={{ background: "#E6F1FB", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#185FA5" }}>{annualCount}</div>
          <div style={{ fontSize: 11, color: "#185FA5", marginTop: 2, opacity: 0.7 }}>Annual leaves</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{myLeaves.length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Total leaves</div>
        </div>
      </div>

      <SectionLabel mt={0}>Apply leave for a future date</SectionLabel>
      <Card>
        <InfoBanner>
          To apply leave for <strong>today</strong>, use the "Apply leave" button on the Log Today page. This form is for planning ahead.
        </InfoBanner>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Date *</label>
            <input type="date" value={date} min={todayLocal} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Leave type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
              {LEAVE_TYPES.map((lt) => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>Reason (optional)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Medical appointment, family event…" />
        </div>
        <Button variant="primary" onClick={applyNew}>Apply leave</Button>
      </Card>

      <SectionLabel>Leave history</SectionLabel>
      {myLeaves.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--c-text-3)", padding: "16px 0" }}>No leaves applied yet</div>
      )}
      {myLeaves.map((l) => {
        const lt = LEAVE_TYPES.find((t) => t.id === l.type)!;
        const isPast = l.date < todayLocal;
        const dl = new Date(l.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", borderRadius: "var(--r-md)", border: "0.5px solid var(--c-border)", marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: lt.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", minWidth: 120 }}>{dl}</span>
            <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 9px", borderRadius: 999, background: lt.bg, color: lt.color }}>{lt.label}</span>
            <span style={{ fontSize: 12, color: "var(--c-text-3)", flex: 1 }}>{l.note || "—"}</span>
            {!isPast && (
              <Button size="xs" variant="danger" onClick={() => { cancelLeave(l.id); showToast("Leave cancelled"); }}>Cancel</Button>
            )}
            {isPast && <span style={{ fontSize: 10, color: "var(--c-text-3)" }}>Past</span>}
          </div>
        );
      })}
    </PageShell>
  );
}
