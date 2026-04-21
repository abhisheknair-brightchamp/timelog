"use client";
// src/components/admin/Dashboard.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, StatCard, Avatar, Chip, DayChip, SectionLabel, Card, Button, showToast } from "@/components/ui";
import { getDayStatus, todayInTz, tzByIana, fmtIST, getShiftHours, sumShiftHours } from "@/lib/utils";
import type { Employee, Timesheet } from "@/types";

export default function Dashboard() {
  const { employees, holidays, timesheets, leaves, queries, createQuery, resolveQuery, rejectTimesheet, reverseRejection, resetShift } = useStore((s) => ({
    employees: s.employees,
    holidays: s.holidays,
    timesheets: s.timesheets,
    leaves: s.leaves,
    queries: s.queries,
    createQuery: s.createQuery,
    resolveQuery: s.resolveQuery,
    rejectTimesheet: s.rejectTimesheet,
    reverseRejection: s.reverseRejection,
    resetShift: s.resetShift,
  }));

  const todayIST = todayInTz("Asia/Kolkata");
  const workers = employees;

  const getStatus = (e: Employee) =>
    getDayStatus(e, todayIST, holidays, timesheets, todayIST, leaves);

  const submitted = workers.filter((e) => getStatus(e) === "logged").length;
  const pending   = workers.filter((e) => ["missing", "upcoming"].includes(getStatus(e))).length;
  const onLeave   = workers.filter((e) => getStatus(e) === "leave").length;
  const off       = workers.filter((e) => ["weekoff", "holiday"].includes(getStatus(e))).length;

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const [queryFor, setQueryFor] = useState<{ tsId: string; empId: string; empName: string } | null>(null);
  const [queryText, setQueryText] = useState("");

  const [rejectFor, setRejectFor] = useState<{ tsId: string; empName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null); // employeeId whose shifts are expanded

  function submitNewQuery() {
    if (!queryFor || !queryText.trim()) { showToast("Enter a question"); return; }
    createQuery(queryFor.tsId, queryFor.empId, queryText.trim());
    showToast(`Query sent to ${queryFor.empName}`);
    setQueryFor(null); setQueryText("");
  }

  function confirmReject() {
    if (!rejectFor || !rejectReason.trim()) { showToast("Enter a reason"); return; }
    rejectTimesheet(rejectFor.tsId, rejectReason.trim());
    showToast(`Shift rejected — ${rejectFor.empName}`);
    setRejectFor(null); setRejectReason("");
  }

  const openQueries = queries.filter((q) => q.status === "open");

  return (
    <PageShell title="Dashboard" subtitle={`Team overview — ${dateLabel} IST`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total teachers"   value={workers.length} />
        <StatCard label="Submitted today"  value={submitted} color="var(--c-brand-dark)" />
        <StatCard label="Pending log"      value={pending}   color="#A32D2D" />
        <StatCard label="On leave"         value={onLeave}   color="#185FA5" />
        <StatCard label="Week off / hol."  value={off}       color="#854F0B" />
      </div>

      {openQueries.length > 0 && (
        <>
          <SectionLabel mt={0}>Open queries ({openQueries.length})</SectionLabel>
          <Card>
            {openQueries.map((q) => {
              const emp = employees.find((e) => e.id === q.employeeId);
              const ts = timesheets.find((t) => t.id === q.timesheetId);
              return (
                <div key={q.id} style={{ padding: "10px 0", borderBottom: "0.5px solid var(--c-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{emp?.name || q.employeeId}</strong>
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>re: {ts?.date || "—"} · {fmtIST(q.createdAt)}</span>
                    {q.response && <Chip label="Replied" variant="blue" tiny />}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 6 }}><strong>Q:</strong> {q.question}</div>
                  {q.response && (
                    <div style={{ fontSize: 12, color: "var(--c-text-2)", marginLeft: 12, paddingLeft: 8, borderLeft: "2px solid var(--c-brand)", marginBottom: 6 }}>
                      <strong>A:</strong> {q.response}
                    </div>
                  )}
                  {q.response
                    ? <Button size="xs" onClick={() => { resolveQuery(q.id); showToast("Query resolved"); }}>Mark resolved</Button>
                    : <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Awaiting employee reply</span>}
                </div>
              );
            })}
          </Card>
        </>
      )}

      <SectionLabel>Today — all teachers</SectionLabel>
      <Card>
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Teacher</th>
              <th style={{ width: "10%" }}>Role</th>
              <th style={{ width: "8%" }}>TZ</th>
              <th style={{ width: "14%" }}>Status</th>
              <th style={{ width: "18%" }}>Hours today</th>
              <th style={{ width: "28%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((e, i) => {
              const status = getStatus(e);
              const todayShifts = timesheets
                .filter((t) => t.employeeId === e.id && t.date === todayIST)
                .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
              const accepted = todayShifts.filter((t) => t.status !== "rejected");
              const hrs = sumShiftHours(accepted);
              const rejected = todayShifts.filter((t) => t.status === "rejected");
              const lv  = leaves.find((l) => l.employeeId === e.id && l.date === todayIST);
              const tz  = tzByIana(e.timezone);
              const isOpen = expanded === e.id;
              return (
                <>
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Avatar name={e.name} index={i} />
                        <div>
                          <div style={{ fontSize: 13 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: "var(--c-text-3)" }}>{e.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Chip label={e.role} variant="green" tiny /></td>
                    <td><span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{tz.short}</span></td>
                    <td><DayChip status={status} /></td>
                    <td>
                      {todayShifts.length > 0 ? (
                        <div>
                          <div>
                            <span style={{ fontWeight: 500, color: "var(--c-brand-dark)" }}>{hrs.toFixed(2)}h</span>
                            <span style={{ fontSize: 11, color: "var(--c-text-3)", marginLeft: 4 }}>/ {e.minHoursPerDay}h target</span>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
                            {todayShifts.length} shift{todayShifts.length === 1 ? "" : "s"}
                            {rejected.length > 0 && ` · ${rejected.length} rejected`}
                          </div>
                        </div>
                      ) : status === "leave" ? (
                        <span style={{ fontSize: 11, color: "#185FA5" }}>
                          {lv ? lv.type.charAt(0).toUpperCase() + lv.type.slice(1) + " leave" : "On leave"}
                        </span>
                      ) : status === "weekoff" || status === "holiday" ? (
                        <span style={{ color: "var(--c-text-3)" }}>—</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>Not started</span>
                      )}
                    </td>
                    <td>
                      {todayShifts.length > 0 && (
                        <Button size="xs" onClick={() => setExpanded(isOpen ? null : e.id)}>
                          {isOpen ? "Hide shifts ▲" : `View ${todayShifts.length} shift${todayShifts.length === 1 ? "" : "s"} ▼`}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {isOpen && todayShifts.map((ts) => (
                    <tr key={ts.id}>
                      <td colSpan={6} style={{ background: "var(--c-bg)", padding: "8px 14px" }}>
                        <ShiftRow
                          ts={ts}
                          tz={e.timezone}
                          empName={e.name}
                          onQuery={() => { setQueryFor({ tsId: ts.id, empId: e.id, empName: e.name }); setQueryText(""); }}
                          onReject={() => { setRejectFor({ tsId: ts.id, empName: e.name }); setRejectReason(""); }}
                          onReverse={() => { reverseRejection(ts.id); showToast("Rejection reversed"); }}
                          onReset={() => { if (confirm(`Reset this shift for ${e.name}? This permanently removes the shift record.`)) { resetShift(ts.id); showToast("Shift reset"); } }}
                        />
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </Card>

      {queryFor && (
        <Modal onClose={() => setQueryFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Question for {queryFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 12 }}>They'll see this on their history page and can respond.</div>
          <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="e.g. This shift was short — what happened?" autoFocus style={modalTextarea} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setQueryFor(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submitNewQuery}>Send question</Button>
          </div>
        </Modal>
      )}

      {rejectFor && (
        <Modal onClose={() => setRejectFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Reject shift — {rejectFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 12 }}>Hours from this shift will be excluded from the employee's accepted totals. You can reverse this later.</div>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (shown to employee)…" autoFocus style={modalTextarea} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirmReject}>Reject shift</Button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

function ShiftRow({ ts, tz, empName, onQuery, onReject, onReverse, onReset }: {
  ts: Timesheet; tz: string; empName: string;
  onQuery: () => void; onReject: () => void; onReverse: () => void; onReset: () => void;
}) {
  const hrs = getShiftHours(ts);
  const rejected = ts.status === "rejected";
  const inProgress = ts.status === "in-progress";
  const clock = (ms?: number) => ms ? new Date(ms).toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--c-text-2)", fontVariantNumeric: "tabular-nums" }}>
          {clock(ts.startedAt)} → {inProgress ? "now" : clock(ts.endedAt)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: rejected ? "#A32D2D" : "var(--c-brand-dark)" }}>
          {hrs.toFixed(2)}h
        </span>
        {inProgress && <Chip label="On the clock" variant="purple" tiny />}
        {rejected && <Chip label="Rejected" variant="red" tiny />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {!inProgress && !rejected && (
            <>
              <Button size="xs" onClick={onQuery}>? Question</Button>
              <Button size="xs" variant="danger" onClick={onReject}>Reject</Button>
            </>
          )}
          {rejected && <Button size="xs" onClick={onReverse}>Reverse</Button>}
          <Button size="xs" variant="danger" onClick={onReset}>Reset</Button>
        </div>
      </div>
      {rejected && ts.rejectionReason && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid #A32D2D" }}>
          <strong>Rejected:</strong> {ts.rejectionReason}
          {ts.rejectedByName && <span style={{ opacity: 0.7 }}> · {ts.rejectedByName}</span>}
        </div>
      )}
      {ts.entries.length === 0
        ? <div style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>No breakdown logged by {empName}</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {ts.entries.map((en, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Chip label={en.vertical} variant="purple" tiny />
                <span style={{ flex: 1, fontSize: 11, color: "var(--c-text-2)" }}>{en.note || "—"}</span>
                <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{en.hours.toFixed(2)}h</span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 480, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        {children}
      </div>
    </div>
  );
}

const modalTextarea: React.CSSProperties = {
  width: "100%", minHeight: 80, padding: 10, fontSize: 13,
  border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "inherit", resize: "vertical", marginBottom: 12,
};
