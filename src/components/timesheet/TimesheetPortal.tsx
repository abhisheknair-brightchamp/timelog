"use client";
// src/components/timesheet/TimesheetPortal.tsx
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import {
  PageShell, SectionLabel, Card, Button, InfoBanner,
  Chip, Avatar, showToast, Toast,
} from "@/components/ui";
import {
  getDayStatus, todayInTz, TIMEZONES, fmtIST, empColor, initials,
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
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function fmtClock(utcMs: number, iana: string): string {
  return new Date(utcMs).toLocaleTimeString("en-US", {
    timeZone: iana,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Log Today (Punch in/out) ─────────────────────────────────────────────────
function LogToday() {
  const { employees, holidays, timesheets, leaves, config, getTimesheet, getLeave, applyLeave, startWorkday, endWorkday, currentEmployeeId } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves, config: s.config,
    getTimesheet: s.getTimesheet, getLeave: s.getLeave, applyLeave: s.applyLeave,
    startWorkday: s.startWorkday, endWorkday: s.endWorkday,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId)!;
  const tz = TIMEZONES.find((t) => t.iana === emp.timezone) || TIMEZONES[0];
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });

  const status: DayStatus = getDayStatus(emp, todayLocal, holidays, timesheets, todayLocal, leaves);
  const ts = getTimesheet(currentEmployeeId, todayLocal);
  const inProgress = !!ts && ts.status === "in-progress";
  const submitted = ts?.submitted ?? false;
  const leave = getLeave(currentEmployeeId, todayLocal);
  const holiday = holidays.find((h) => h.date === todayLocal);

  // Live clock — updates once a second while clocked in
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inProgress]);

  // Entry form state for clock-out breakdown
  const [rows, setRows] = useState<TimesheetEntry[]>([
    { vertical: config.verticals[0] || "", note: "", hours: 0 },
  ]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [leaveNote, setLeaveNote] = useState("");

  function addRow() { setRows((r) => [...r, { vertical: config.verticals[0] || "", note: "", hours: 0 }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, patch: Partial<TimesheetEntry>) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  function onClockIn() {
    startWorkday(currentEmployeeId, todayLocal, emp.timezone);
    showToast("Clocked in — have a productive day");
  }

  function onClockOut() {
    if (!ts) return;
    // Drop empty rows, but any partially-filled row must be fully valid.
    const filled = rows.filter((r) => r.vertical || r.hours > 0 || r.note);
    for (const row of filled) {
      if (!row.vertical) { showToast("Vertical is required for all filled entries"); return; }
      if (!row.hours || row.hours <= 0) { showToast("Hours required for all filled entries"); return; }
    }
    const total = filled.reduce((a, r) => a + (r.hours || 0), 0);
    const capturedMs = ts.startedAt ? Date.now() - ts.startedAt : 0;
    const capturedHrs = capturedMs / 3600000;
    endWorkday(ts.id, filled);
    const belowMin = total < emp.minHoursPerDay;
    showToast(
      belowMin
        ? `Clocked out — ${total.toFixed(1)}h logged / ${capturedHrs.toFixed(2)}h captured (below ${emp.minHoursPerDay}h min)`
        : `Clocked out — ${total.toFixed(1)}h logged / ${capturedHrs.toFixed(2)}h captured`
    );
  }

  function submitLeave() {
    applyLeave(currentEmployeeId, todayLocal, leaveType, leaveNote);
    setShowLeaveForm(false);
    showToast("Leave applied");
  }

  const dayLabel = new Date(todayLocal + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const elapsedMs = ts?.startedAt ? now - ts.startedAt : 0;
  const suggestedHours = Math.max(0.5, Math.round(elapsedMs / 3600000 * 2) / 2); // nearest 0.5h

  return (
    <PageShell title="Log today" subtitle={`${emp.name} · ${tz.short} · ${dayLabel}`}>

      {/* Status banner */}
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

      {/* Punch flow — working day, no leave */}
      {status !== "weekoff" && status !== "holiday" && status !== "leave" && (
        <>
          {/* Not started yet */}
          {!ts && (
            <Card highlight>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 6 }}>Ready to start your day?</div>
                <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>Clock in to begin</div>
                <Button variant="primary" onClick={onClockIn}>▶ Clock in</Button>
                <div style={{ marginTop: 16, fontSize: 11, color: "var(--c-text-3)" }}>
                  Or{" "}
                  <button onClick={() => setShowLeaveForm(true)} style={{ background: "none", border: "none", color: "var(--c-brand-dark)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
                    apply leave for today
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* In progress — live timer + clock-out form */}
          {ts && inProgress && (
            <>
              <Card highlight>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>On the clock</div>
                    <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>
                      Clocked in at <strong>{ts.startedAt ? fmtClock(ts.startedAt, emp.timezone) : ""}</strong>
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
                Fill in what you worked on. You can clock out anytime — captured time ({suggestedHours.toFixed(1)}h so far) is always saved separately from the breakdown you enter. Target is <strong>{emp.minHoursPerDay}h</strong>.
              </InfoBanner>

              <Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8 }}>
                  {["Vertical *", "What did you work on?", "Hours *", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 500, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>

                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <select value={row.vertical} onChange={(e) => updateRow(ri, { vertical: e.target.value })}>
                      {config.verticals.map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <input type="text" value={row.note} placeholder="Brief description…" onChange={(e) => updateRow(ri, { note: e.target.value })} />
                    <input type="number" value={row.hours || ""} placeholder="0" min={0.5} max={14} step={0.5} onChange={(e) => updateRow(ri, { hours: parseFloat(e.target.value) || 0 })} />
                    {rows.length > 1
                      ? <button onClick={() => removeRow(ri)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-text-3)", padding: 0, lineHeight: 1 }}>×</button>
                      : <span />}
                  </div>
                ))}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "0.5px solid var(--c-border)", marginTop: 4 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button size="xs" onClick={addRow}>+ Add row</Button>
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Target {emp.minHoursPerDay}h · partial is OK</span>
                  </div>
                  <Button variant="primary" size="sm" onClick={onClockOut}>■ Clock out &amp; submit</Button>
                </div>
              </Card>
            </>
          )}

          {/* Already submitted for today */}
          {ts && submitted && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Today's timesheet</div>
                <Chip label="✓ Submitted" variant="green" />
              </div>
              {ts.entries.map((en, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <Chip label={en.vertical} variant="purple" />
                  <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{en.note || "—"}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{en.hours.toFixed(1)}h</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "0.5px solid var(--c-border)", marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                  {ts.startedAt && ts.endedAt
                    ? `${fmtClock(ts.startedAt, emp.timezone)} → ${fmtClock(ts.endedAt, emp.timezone)}`
                    : ts.submittedAt ? `Submitted ${fmtIST(ts.submittedAt)}` : ""}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--c-brand-dark)" }}>
                    {ts.totalHours.toFixed(1)}h logged
                  </div>
                  {typeof ts.capturedHours === "number" && (
                    <div style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                      {ts.capturedHours.toFixed(2)}h on the clock
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Leave application form */}
          {showLeaveForm && !submitted && (
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

// ─── My History (with queries) ────────────────────────────────────────────────
function MyHistory() {
  const { employees, holidays, timesheets, leaves, queries, currentEmployeeId, respondQuery } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves, queries: s.queries,
    currentEmployeeId: s.currentEmployeeId,
    respondQuery: s.respondQuery,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId)!;
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });
  const empTimesheets = timesheets.filter((t) => t.employeeId === currentEmployeeId && t.submitted).sort((a, b) => b.date.localeCompare(a.date));

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

  const totalHours = empTimesheets.reduce((a, t) => a + t.totalHours, 0);
  const myQueries = queries.filter((q) => q.employeeId === currentEmployeeId);
  const openQueries = myQueries.filter((q) => q.status === "open" && !q.response);

  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function submitReply(queryId: string) {
    if (!replyText.trim()) { showToast("Enter a response"); return; }
    respondQuery(queryId, replyText.trim());
    setReplyFor(null);
    setReplyText("");
    showToast("Response sent");
  }

  return (
    <PageShell title="My history" subtitle="Monthly overview and submitted timesheets">

      {openQueries.length > 0 && (
        <>
          <SectionLabel mt={0}>Open questions from admin ({openQueries.length})</SectionLabel>
          {openQueries.map((q) => {
            const relatedTs = timesheets.find((t) => t.id === q.timesheetId);
            return (
              <Card key={q.id} highlight>
                <div style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 4 }}>
                  {q.byActorName} · {fmtIST(q.createdAt)}
                  {relatedTs && ` · re: ${relatedTs.date}`}
                </div>
                <div style={{ fontSize: 13, color: "var(--c-text)", marginBottom: 12 }}>"{q.question}"</div>
                {replyFor === q.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Your response…" autoFocus style={{ flex: 1 }} />
                    <Button variant="primary" size="sm" onClick={() => submitReply(q.id)}>Send</Button>
                    <Button size="sm" onClick={() => { setReplyFor(null); setReplyText(""); }}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => { setReplyFor(q.id); setReplyText(""); }}>Reply</Button>
                )}
              </Card>
            );
          })}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20, marginTop: openQueries.length > 0 ? 20 : 0 }}>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--c-brand-dark)" }}>{totalHours.toFixed(1)}h</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Total hours this month</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{empTimesheets.length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Days submitted</div>
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

      {empTimesheets.length > 0 && (
        <>
          <SectionLabel>Submitted timesheets</SectionLabel>
          {empTimesheets.map((ts) => {
            const dl = new Date(ts.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
            const tsQueries = myQueries.filter((q) => q.timesheetId === ts.id);
            return (
              <div key={ts.id} style={{ border: "0.5px solid var(--c-border)", borderRadius: "var(--r-lg)", padding: 14, marginBottom: 8, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{dl}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-brand-dark)" }}>{ts.totalHours.toFixed(1)}h logged</span>
                    {typeof ts.capturedHours === "number" && (
                      <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>· {ts.capturedHours.toFixed(2)}h captured</span>
                    )}
                    {tsQueries.length > 0 && <Chip label={`${tsQueries.length} query${tsQueries.length === 1 ? "" : "ies"}`} variant="amber" />}
                    <Chip label="Submitted" variant="green" />
                  </div>
                </div>
                {ts.entries.map((en, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: "0.5px solid var(--c-border)", alignItems: "center" }}>
                    <Chip label={en.vertical} variant="purple" />
                    <span style={{ flex: 1, fontSize: 12, color: "var(--c-text-2)" }}>{en.note || "—"}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{en.hours.toFixed(1)}h</span>
                  </div>
                ))}
                {tsQueries.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--c-border)" }}>
                    {tsQueries.map((q) => (
                      <div key={q.id} style={{ padding: "8px 0", fontSize: 12 }}>
                        <div style={{ color: "var(--c-text-3)", marginBottom: 4 }}>
                          <strong>{q.byActorName}:</strong> {q.question}
                        </div>
                        {q.response && (
                          <div style={{ color: "var(--c-text-2)", marginLeft: 12, paddingLeft: 8, borderLeft: "2px solid var(--c-brand)" }}>
                            You replied: {q.response}
                          </div>
                        )}
                        {q.status === "resolved" && <Chip label="Resolved" variant="green" tiny />}
                      </div>
                    ))}
                  </div>
                )}
                {ts.submittedAt && <div style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 8 }}>Submitted {fmtIST(ts.submittedAt)}</div>}
              </div>
            );
          })}
        </>
      )}
    </PageShell>
  );
}

// ─── My Leaves (unchanged logic) ──────────────────────────────────────────────
function MyLeaves() {
  const { employees, leaves, applyLeave, cancelLeave, holidays, timesheets, currentEmployeeId } = useStore((s) => ({
    employees: s.employees, leaves: s.leaves,
    applyLeave: s.applyLeave, cancelLeave: s.cancelLeave,
    holidays: s.holidays, timesheets: s.timesheets,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const emp = employees.find((e) => e.id === currentEmployeeId)!;
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
