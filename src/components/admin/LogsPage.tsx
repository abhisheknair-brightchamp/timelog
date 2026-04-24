"use client";
// src/components/admin/LogsPage.tsx
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import {
  PageShell, Card, SectionLabel, Avatar, Chip, Button, showToast,
} from "@/components/ui";
import { getShiftHours, getOriginalHours, sumShiftHours, fmtIST } from "@/lib/utils";
import type { Timesheet, TimesheetEntry } from "@/types";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thirtyDaysAgo() {
  const d = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LogsPage() {
  const {
    employees, timesheets, config,
    createQuery, rejectTimesheet, reverseRejection,
    adjustTimesheet, resetShift, resetCheckin, resetCheckout, adminAddTimeLog,
  } = useStore((s) => ({
    employees: s.employees,
    timesheets: s.timesheets,
    config: s.config,
    createQuery: s.createQuery,
    rejectTimesheet: s.rejectTimesheet,
    reverseRejection: s.reverseRejection,
    adjustTimesheet: s.adjustTimesheet,
    resetShift: s.resetShift,
    resetCheckin: s.resetCheckin,
    resetCheckout: s.resetCheckout,
    adminAddTimeLog: s.adminAddTimeLog,
  }));

  const [empFilter, setEmpFilter] = useState<string>("all");
  const [from, setFrom] = useState(thirtyDaysAgo());
  const [to, setTo] = useState(todayStr());

  const [queryFor, setQueryFor] = useState<{ tsId: string; empId: string; empName: string } | null>(null);
  const [queryText, setQueryText] = useState("");
  const [rejectFor, setRejectFor] = useState<{ tsId: string; empName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resetFor, setResetFor] = useState<{ ts: Timesheet; empName: string } | null>(null);
  const [adjustFor, setAdjustFor] = useState<{ ts: Timesheet; empName: string } | null>(null);
  const [adjustValue, setAdjustValue] = useState(0);

  const [addLogFor, setAddLogFor] = useState<string | null>(null);
  const [addLogDate, setAddLogDate] = useState("");
  const [addLogCheckin, setAddLogCheckin] = useState("");
  const [addLogCheckout, setAddLogCheckout] = useState("");
  const [addLogRows, setAddLogRows] = useState<TimesheetEntry[]>([{ vertical: "", note: "", hours: 0 }]);

  const filtered = useMemo(() => {
    return timesheets
      .filter((t) => {
        if (empFilter !== "all" && t.employeeId !== empFilter) return false;
        if (t.date < from || t.date > to) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || 0) - (a.startedAt || 0));
  }, [timesheets, empFilter, from, to]);

  // Group by date then employee
  const grouped = useMemo(() => {
    const map: Record<string, { emp: typeof employees[0] | undefined; shifts: Timesheet[] }[]> = {};
    filtered.forEach((ts) => {
      if (!map[ts.date]) map[ts.date] = [];
      let group = map[ts.date].find((g) => g.emp?.id === ts.employeeId || (!g.emp && ts.employeeId === "?"));
      if (!group) {
        group = { emp: employees.find((e) => e.id === ts.employeeId), shifts: [] };
        map[ts.date].push(group);
      }
      group.shifts.push(ts);
    });
    return map;
  }, [filtered, employees]);

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function submitQuery() {
    if (!queryFor || !queryText.trim()) { showToast("Enter a question"); return; }
    createQuery(queryFor.tsId, queryFor.empId, queryText.trim());
    showToast(`Query sent to ${queryFor.empName}`);
    setQueryFor(null); setQueryText("");
  }

  function confirmReject() {
    if (!rejectFor || !rejectReason.trim()) { showToast("Enter a reason"); return; }
    rejectTimesheet(rejectFor.tsId, rejectReason.trim());
    showToast("Shift rejected");
    setRejectFor(null); setRejectReason("");
  }

  function submitAddLog() {
    const emp = employees.find((e) => e.id === addLogFor);
    if (!emp || !addLogDate || !addLogCheckin || !addLogCheckout) {
      showToast("Fill all required fields"); return;
    }
    const checkinMs = new Date(`${addLogDate}T${addLogCheckin}`).getTime();
    const checkoutMs = new Date(`${addLogDate}T${addLogCheckout}`).getTime();
    if (isNaN(checkinMs) || isNaN(checkoutMs)) { showToast("Invalid time"); return; }
    if (checkoutMs <= checkinMs) { showToast("Check-out must be after check-in"); return; }
    adminAddTimeLog(emp.id, addLogDate, checkinMs, checkoutMs, addLogRows.filter((r) => r.hours > 0));
    showToast(`Time log added for ${emp.name}`);
    setAddLogFor(null);
  }

  return (
    <PageShell
      title="Logs"
      subtitle="Browse and manage all employee timesheets"
      actions={
        <Button variant="primary" size="sm" onClick={() => {
          setAddLogFor(employees[0]?.id || null);
          setAddLogDate(todayStr());
          setAddLogCheckin("09:00");
          setAddLogCheckout("17:00");
          setAddLogRows([{ vertical: config.verticals[0] || "", note: "", hours: 0 }]);
        }}>
          + Add time log
        </Button>
      }
    >
      {/* Filters */}
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Employee</label>
            <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} style={{ minWidth: 180 }}>
              <option value="all">All employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => { setFrom(thirtyDaysAgo()); setTo(todayStr()); }} style={presetBtn}>Last 30 days</button>
            <button onClick={() => {
              const now = new Date();
              setFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
              setTo(todayStr());
            }} style={presetBtn}>This month</button>
          </div>
        </div>
      </Card>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-3)", fontSize: 13 }}>
          No timesheets found for this filter.
        </div>
      )}

      {dates.map((date) => (
        <div key={date}>
          <SectionLabel>{formatDate(date)}</SectionLabel>
          <Card>
            {grouped[date].map(({ emp, shifts }, gi) => {
              const accepted = shifts.filter((t) => t.status !== "rejected");
              const totalHrs = sumShiftHours(accepted);
              const empIdx = employees.findIndex((e) => e.id === emp?.id);
              return (
                <div key={emp?.id || gi} style={{
                  borderBottom: gi < grouped[date].length - 1 ? "0.5px solid var(--c-border)" : "none",
                  paddingBottom: gi < grouped[date].length - 1 ? 14 : 0,
                  marginBottom: gi < grouped[date].length - 1 ? 14 : 0,
                }}>
                  {/* Employee header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Avatar name={emp?.name || "?"} index={empIdx >= 0 ? empIdx : 0} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{emp?.name || "Unknown"}</div>
                      <div style={{ fontSize: 10, color: "var(--c-text-3)" }}>{emp?.email}</div>
                    </div>
                    <Chip label={emp?.role || "—"} variant="green" tiny />
                    <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-brand-dark)", fontWeight: 500 }}>
                      {totalHrs.toFixed(2)}h accepted
                    </div>
                    <Button size="xs" onClick={() => {
                      setAddLogFor(emp?.id || null);
                      setAddLogDate(date);
                      setAddLogCheckin("09:00");
                      setAddLogCheckout("17:00");
                      setAddLogRows([{ vertical: config.verticals[0] || "", note: "", hours: 0 }]);
                    }}>+ Log</Button>
                  </div>

                  {/* Shifts */}
                  {shifts.map((ts) => (
                    <ShiftRow
                      key={ts.id}
                      ts={ts}
                      tz={emp?.timezone || "Asia/Kolkata"}
                      empName={emp?.name || "?"}
                      onQuery={() => { setQueryFor({ tsId: ts.id, empId: ts.employeeId, empName: emp?.name || "?" }); setQueryText(""); }}
                      onReject={() => { setRejectFor({ tsId: ts.id, empName: emp?.name || "?" }); setRejectReason(""); }}
                      onReverse={() => { reverseRejection(ts.id); showToast("Rejection reversed"); }}
                      onReset={() => setResetFor({ ts, empName: emp?.name || "?" })}
                      onAdjust={() => {
                        const orig = getOriginalHours(ts);
                        setAdjustValue(typeof ts.adjustedHours === "number" ? ts.adjustedHours : orig);
                        setAdjustFor({ ts, empName: emp?.name || "?" });
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </Card>
        </div>
      ))}

      {/* Query modal */}
      {queryFor && (
        <Modal onClose={() => setQueryFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Question for {queryFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 12 }}>They'll see this on their history page and can respond.</div>
          <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="e.g. This shift was short — what happened?" autoFocus style={modalTextarea} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setQueryFor(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submitQuery}>Send question</Button>
          </div>
        </Modal>
      )}

      {/* Reject modal */}
      {rejectFor && (
        <Modal onClose={() => setRejectFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Reject shift — {rejectFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 12 }}>Hours from this shift will be excluded from totals. You can reverse this later.</div>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (shown to employee)…" autoFocus style={modalTextarea} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirmReject}>Reject shift</Button>
          </div>
        </Modal>
      )}

      {/* Reset modal */}
      {resetFor && (
        <Modal onClose={() => setResetFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Reset shift — {resetFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 16 }}>Choose what to reset. The employee will be notified.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <ResetOption title="Reset check-in only" description="Clears the check-in time. Employee needs to clock in again."
              onClick={() => { resetCheckin(resetFor.ts.id); showToast(`Check-in reset for ${resetFor.empName}`); setResetFor(null); }} />
            <ResetOption title="Reset check-out only" description="Reverts the shift to in-progress. Employee needs to clock out again."
              onClick={() => { resetCheckout(resetFor.ts.id); showToast(`Check-out reset for ${resetFor.empName}`); setResetFor(null); }} />
            <ResetOption title="Reset both (full reset)" description="Permanently removes this shift record entirely." danger
              onClick={() => { resetShift(resetFor.ts.id); showToast(`Shift fully reset for ${resetFor.empName}`); setResetFor(null); }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setResetFor(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* Adjust hours modal */}
      {adjustFor && (() => {
        const orig = getOriginalHours(adjustFor.ts);
        const step = 0.25;
        const max = Math.ceil(orig / step) * step;
        return (
          <Modal onClose={() => setAdjustFor(null)}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Adjust hours — {adjustFor.empName}</div>
            <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 16 }}>
              Clocked: <strong>{orig.toFixed(2)}h</strong>. Drag to set the hours that should count.
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                type="range"
                min={0}
                max={max}
                step={step}
                value={adjustValue}
                onChange={(e) => setAdjustValue(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--c-brand)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                <span>0h</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--c-brand-dark)" }}>{adjustValue.toFixed(2)}h</span>
                <span>{max.toFixed(2)}h</span>
              </div>
            </div>
            {adjustFor.ts.adjustedHours !== undefined && (
              <div style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 12 }}>
                Previously adjusted to {adjustFor.ts.adjustedHours.toFixed(2)}h.{" "}
                <button
                  onClick={() => setAdjustValue(orig)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-brand-dark)", fontSize: 11, padding: 0, textDecoration: "underline" }}
                >
                  Reset to original
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" onClick={() => setAdjustFor(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => {
                adjustTimesheet(adjustFor.ts.id, adjustValue);
                showToast(`Hours adjusted to ${adjustValue.toFixed(2)}h for ${adjustFor.empName}`);
                setAdjustFor(null);
              }}>
                Save adjustment
              </Button>
            </div>
          </Modal>
        );
      })()}

      {/* Add log modal */}
      {addLogFor !== null && (
        <Modal onClose={() => setAddLogFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Add time log manually</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Employee *</label>
            <select value={addLogFor} onChange={(e) => setAddLogFor(e.target.value)} style={{ width: "100%" }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Date *</label>
            <input type="date" value={addLogDate} onChange={(e) => setAddLogDate(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Check-in *</label>
              <input type="time" value={addLogCheckin} onChange={(e) => setAddLogCheckin(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Check-out *</label>
              <input type="time" value={addLogCheckout} onChange={(e) => setAddLogCheckout(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Breakdown (optional)</label>
            {addLogRows.map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 70px 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <select value={row.vertical} onChange={(e) => setAddLogRows((r) => r.map((x, i) => i === ri ? { ...x, vertical: e.target.value } : x))}>
                  <option value="">—</option>
                  {config.verticals.map((v) => <option key={v}>{v}</option>)}
                </select>
                <input type="text" value={row.note} placeholder="Note…" onChange={(e) => setAddLogRows((r) => r.map((x, i) => i === ri ? { ...x, note: e.target.value } : x))} />
                <input type="number" value={row.hours || ""} placeholder="0" min={0.25} step={0.25} onChange={(e) => setAddLogRows((r) => r.map((x, i) => i === ri ? { ...x, hours: parseFloat(e.target.value) || 0 } : x))} />
                {addLogRows.length > 1
                  ? <button onClick={() => setAddLogRows((r) => r.filter((_, i) => i !== ri))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--c-text-3)", padding: 0 }}>×</button>
                  : <span />}
              </div>
            ))}
            <Button size="xs" onClick={() => setAddLogRows((r) => [...r, { vertical: config.verticals[0] || "", note: "", hours: 0 }])}>+ Row</Button>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setAddLogFor(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submitAddLog}>Add time log</Button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

function ShiftRow({ ts, tz, empName, onQuery, onReject, onReverse, onReset, onAdjust }: {
  ts: Timesheet; tz: string; empName: string;
  onQuery: () => void; onReject: () => void; onReverse: () => void; onReset: () => void; onAdjust: () => void;
}) {
  const hrs = getShiftHours(ts);
  const origHrs = getOriginalHours(ts);
  const isAdjusted = typeof ts.adjustedHours === "number";
  const rejected = ts.status === "rejected";
  const inProgress = ts.status === "in-progress";
  const clock = (ms?: number) => ms
    ? new Date(ms).toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";
  return (
    <div style={{
      background: rejected ? "#FEF6F6" : "var(--c-bg)",
      border: `0.5px solid ${rejected ? "#F09595" : "var(--c-border)"}`,
      borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--c-text-2)", fontVariantNumeric: "tabular-nums" }}>
          {clock(ts.startedAt)} → {inProgress ? "now" : clock(ts.endedAt)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: rejected ? "#A32D2D" : "var(--c-brand-dark)" }}>
          {hrs.toFixed(2)}h
        </span>
        {isAdjusted && !rejected && (
          <span style={{ fontSize: 11, color: "var(--c-text-3)", textDecoration: "line-through" }}>{origHrs.toFixed(2)}h</span>
        )}
        {isAdjusted && !rejected && <Chip label="Adjusted" variant="blue" tiny />}
        {inProgress && <Chip label="On the clock" variant="purple" tiny />}
        {rejected && <Chip label="Rejected" variant="red" tiny />}
        {ts.submittedAt && (
          <span style={{ fontSize: 10, color: "var(--c-text-3)" }}>submitted {fmtIST(ts.submittedAt)}</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {!inProgress && !rejected && (
            <>
              <Button size="xs" onClick={onAdjust}>⇔ Adjust</Button>
              <Button size="xs" onClick={onQuery}>? Question</Button>
              <Button size="xs" variant="danger" onClick={onReject}>Reject</Button>
            </>
          )}
          {rejected && <Button size="xs" onClick={onReverse}>↩ Reverse</Button>}
          <Button size="xs" variant="danger" onClick={onReset}>Reset…</Button>
        </div>
      </div>
      {rejected && ts.rejectionReason && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 6, paddingLeft: 8, borderLeft: "2px solid #A32D2D" }}>
          <strong>Rejected:</strong> {ts.rejectionReason}
          {ts.rejectedByName && <span style={{ opacity: 0.7 }}> · by {ts.rejectedByName}</span>}
        </div>
      )}
      {ts.entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
          {ts.entries.map((en, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Chip label={en.vertical} variant="purple" tiny />
              <span style={{ flex: 1, fontSize: 11, color: "var(--c-text-2)" }}>{en.note || "—"}</span>
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{en.hours.toFixed(2)}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResetOption({ title, description, danger, onClick }: {
  title: string; description: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer",
      border: `0.5px solid ${danger ? "#F09595" : "var(--c-border-strong)"}`,
      background: danger ? "#FEF6F6" : "var(--c-bg)", fontFamily: "var(--font-body)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? "#A32D2D" : "var(--c-text)", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: danger ? "#A32D2D" : "var(--c-text-3)", opacity: 0.8 }}>{description}</div>
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 };
const modalTextarea: React.CSSProperties = { width: "100%", minHeight: 80, padding: 10, fontSize: 13, border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)", fontFamily: "inherit", resize: "vertical", marginBottom: 12 };
const presetBtn: React.CSSProperties = { padding: "6px 12px", fontSize: 11, border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)", background: "var(--c-bg)", cursor: "pointer", fontFamily: "var(--font-body)", color: "var(--c-text-2)" };
