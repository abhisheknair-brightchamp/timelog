"use client";
// src/components/timesheet/TimesheetPortal.tsx
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import {
  PageShell, SectionLabel, Card, Button, InfoBanner,
  Chip, Avatar, showToast, Toast,
} from "@/components/ui";
import {
  getDayStatus, todayInTz, TIMEZONES, fmtIST, empColor, initials,
} from "@/lib/utils";
import type { DayStatus, TimesheetEntry, LeaveType } from "@/types";

const DEMO_EMP_ID = "e1";

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

// ─── Log Today ────────────────────────────────────────────────────────────────
function LogToday() {
  const { employees, holidays, timesheets, leaves, config, submitTimesheet, getTimesheet, getLeave, applyLeave } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves, config: s.config,
    submitTimesheet: s.submitTimesheet, getTimesheet: s.getTimesheet,
    getLeave: s.getLeave, applyLeave: s.applyLeave,
  }));

  const emp = employees.find((e) => e.id === DEMO_EMP_ID)!;
  const tz = TIMEZONES.find((t) => t.iana === emp.timezone) || TIMEZONES[0];
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });

  const status: DayStatus = getDayStatus(emp, todayLocal, holidays, timesheets, todayLocal, leaves);
  const ts = getTimesheet(DEMO_EMP_ID, todayLocal);
  const submitted = ts?.submitted ?? false;
  const leave = getLeave(DEMO_EMP_ID, todayLocal);
  const holiday = holidays.find((h) => h.date === todayLocal);

  const [rows, setRows] = useState<TimesheetEntry[]>([
    { vertical: config.verticals[0] || "", note: "", hours: 0 },
  ]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [leaveNote, setLeaveNote] = useState("");

  // If already submitted, show those entries
  const displayRows = submitted ? ts!.entries : rows;

  function addRow() { setRows((r) => [...r, { vertical: config.verticals[0] || "", note: "", hours: 0 }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, patch: Partial<TimesheetEntry>) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  function submit() {
    if (submitted) return;
    for (const row of rows) {
      if (!row.vertical) { showToast("Vertical is required for all entries"); return; }
      if (!row.hours || row.hours <= 0) { showToast("Hours required for all entries"); return; }
    }
    const total = rows.reduce((a, r) => a + (r.hours || 0), 0);
    if (total < emp.minHoursPerDay) { showToast(`Minimum ${emp.minHoursPerDay}h required — entered ${total.toFixed(1)}h`); return; }
    submitTimesheet({ employeeId: DEMO_EMP_ID, date: todayLocal, entries: rows, totalHours: total, submitted: true, submittedAt: Date.now(), submittedFromTz: emp.timezone });
    showToast(`Submitted — ${total.toFixed(1)}h logged`);
  }

  function submitLeave() {
    applyLeave(DEMO_EMP_ID, todayLocal, leaveType, leaveNote);
    setShowLeaveForm(false);
    showToast("Leave applied");
  }

  const dayLabel = new Date(todayLocal + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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

      {/* Main logging area — only when working day and not on leave */}
      {status !== "weekoff" && status !== "holiday" && status !== "leave" && (
        <>
          <InfoBanner>
            <strong>Vertical</strong> and <strong>hours</strong> are required.
            Minimum <strong>{emp.minHoursPerDay}h</strong> per day.
            {!submitted && " Need to take leave instead? Use the button below."}
          </InfoBanner>

          <Card highlight={!submitted}>
            {/* Column headers */}
            {!submitted && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8 }}>
                {["Vertical *", "What did you work on?", "Hours *", ""].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 500, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>
            )}

            {displayRows.map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                {submitted ? (
                  <>
                    <Chip label={row.vertical} variant="purple" />
                    <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{row.note || "—"}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{row.hours.toFixed(1)}h</span>
                    <span />
                  </>
                ) : (
                  <>
                    <select value={row.vertical} onChange={(e) => updateRow(ri, { vertical: e.target.value })}>
                      {config.verticals.map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <input type="text" value={row.note} placeholder="Brief description…" onChange={(e) => updateRow(ri, { note: e.target.value })} />
                    <input type="number" value={row.hours || ""} placeholder="0" min={0.5} max={14} step={0.5} onChange={(e) => updateRow(ri, { hours: parseFloat(e.target.value) || 0 })} />
                    {rows.length > 1
                      ? <button onClick={() => removeRow(ri)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-text-3)", padding: 0, lineHeight: 1 }}>×</button>
                      : <span />}
                  </>
                )}
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "0.5px solid var(--c-border)", marginTop: 4 }}>
              {submitted ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                    Submitted {ts?.submittedAt ? fmtIST(ts.submittedAt) : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--c-brand-dark)" }}>
                      {ts!.totalHours.toFixed(1)}h logged
                    </span>
                    <Chip label="✓ Submitted" variant="green" />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button size="xs" onClick={addRow}>+ Add row</Button>
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Min {emp.minHoursPerDay}h required</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="sm" onClick={() => setShowLeaveForm(true)}>Apply leave</Button>
                    <Button variant="primary" size="sm" onClick={submit}>Submit day</Button>
                  </div>
                </>
              )}
            </div>
          </Card>

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

// ─── My History ───────────────────────────────────────────────────────────────
function MyHistory() {
  const { employees, holidays, timesheets, leaves } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays,
    timesheets: s.timesheets, leaves: s.leaves,
  }));

  const emp = employees.find((e) => e.id === DEMO_EMP_ID)!;
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });
  const empTimesheets = timesheets.filter((t) => t.employeeId === DEMO_EMP_ID && t.submitted).sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  type StatusStyle = { bg: string; color: string };
  const STATUS_STYLES: Record<DayStatus, StatusStyle> = {
    logged:   { bg: "#E6F1FB", color: "#185FA5" },
    missing:  { bg: "#FCEBEB", color: "#A32D2D" },
    weekoff:  { bg: "#F1EFE8", color: "#5F5E5A" },
    holiday:  { bg: "#FAEEDA", color: "#854F0B" },
    upcoming: { bg: "#fff",    color: "var(--c-text-2)" },
    future:   { bg: "#fff",    color: "var(--c-text-3)" },
    leave:    { bg: "#FCEBEB", color: "#A32D2D" },
  };

  const totalHours = empTimesheets.reduce((a, t) => a + t.totalHours, 0);

  return (
    <PageShell title="My history" subtitle="Monthly overview and submitted timesheets">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--c-brand-dark)" }}>{totalHours.toFixed(1)}h</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Total hours this month</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{empTimesheets.length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Days submitted</div>
        </div>
        <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{leaves.filter((l) => l.employeeId === DEMO_EMP_ID).length}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>Leaves taken</div>
        </div>
      </div>

      <SectionLabel mt={0}>{monthLabel}</SectionLabel>

      {/* Legend */}
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
            return (
              <div key={ts.id} style={{ border: "0.5px solid var(--c-border)", borderRadius: "var(--r-lg)", padding: 14, marginBottom: 8, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{dl}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-brand-dark)" }}>{ts.totalHours.toFixed(1)}h</span>
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
                {ts.submittedAt && <div style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 8 }}>Submitted {fmtIST(ts.submittedAt)}</div>}
              </div>
            );
          })}
        </>
      )}
    </PageShell>
  );
}

// ─── My Leaves ────────────────────────────────────────────────────────────────
function MyLeaves() {
  const { employees, leaves, applyLeave, cancelLeave, holidays, timesheets } = useStore((s) => ({
    employees: s.employees, leaves: s.leaves,
    applyLeave: s.applyLeave, cancelLeave: s.cancelLeave,
    holidays: s.holidays, timesheets: s.timesheets,
  }));

  const emp = employees.find((e) => e.id === DEMO_EMP_ID)!;
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: emp.timezone });
  const myLeaves = leaves.filter((l) => l.employeeId === DEMO_EMP_ID).sort((a, b) => b.date.localeCompare(a.date));

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
    applyLeave(DEMO_EMP_ID, date, type, note);
    setDate(""); setNote("");
    showToast("Leave applied for " + date);
  }

  const sickCount = myLeaves.filter((l) => l.type === "sick").length;
  const annualCount = myLeaves.filter((l) => l.type === "annual").length;

  return (
    <PageShell title="My leaves" subtitle="Apply and manage your leave requests">
      {/* Summary */}
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

      {/* Apply new leave — future dates only */}
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

      {/* Leave history */}
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
