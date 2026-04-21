"use client";
// src/components/admin/Dashboard.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, StatCard, Avatar, Chip, DayChip, SectionLabel, Card, Button, showToast } from "@/components/ui";
import { getDayStatus, todayInTz, tzByIana, fmtIST, getShiftHours, sumShiftHours, TIMEZONES } from "@/lib/utils";
import type { Employee, Timesheet, TimesheetEntry } from "@/types";

export default function Dashboard() {
  const {
    employees, holidays, timesheets, leaves, queries, config, notifications,
    createQuery, addQueryMessage, resolveQuery, rejectTimesheet, reverseRejection,
    resetShift, resetCheckin, resetCheckout, adminAddTimeLog, markNotificationsRead,
  } = useStore((s) => ({
    employees: s.employees,
    holidays: s.holidays,
    timesheets: s.timesheets,
    leaves: s.leaves,
    queries: s.queries,
    config: s.config,
    notifications: s.notifications,
    createQuery: s.createQuery,
    addQueryMessage: s.addQueryMessage,
    resolveQuery: s.resolveQuery,
    rejectTimesheet: s.rejectTimesheet,
    reverseRejection: s.reverseRejection,
    resetShift: s.resetShift,
    resetCheckin: s.resetCheckin,
    resetCheckout: s.resetCheckout,
    adminAddTimeLog: s.adminAddTimeLog,
    markNotificationsRead: s.markNotificationsRead,
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

  const [resetFor, setResetFor] = useState<{ ts: Timesheet; empName: string } | null>(null);

  // Admin add time log modal
  const [addLogFor, setAddLogFor] = useState<Employee | null>(null);
  const [addLogDate, setAddLogDate] = useState("");
  const [addLogCheckin, setAddLogCheckin] = useState("");
  const [addLogCheckout, setAddLogCheckout] = useState("");
  const [addLogRows, setAddLogRows] = useState<TimesheetEntry[]>([
    { vertical: "", note: "", hours: 0 },
  ]);

  const [replyFor, setReplyFor] = useState<string | null>(null); // queryId
  const [replyText, setReplyText] = useState("");

  const adminUnread = notifications.filter((n) => n.employeeId === "admin" && !n.read);

  const [expanded, setExpanded] = useState<string | null>(null);

  function submitNewQuery() {
    if (!queryFor || !queryText.trim()) { showToast("Enter a question"); return; }
    createQuery(queryFor.tsId, queryFor.empId, queryText.trim());
    showToast(`Query sent to ${queryFor.empName}`);
    setQueryFor(null); setQueryText("");
  }

  function confirmReject() {
    if (!rejectFor || !rejectReason.trim()) { showToast("Enter a reason"); return; }
    rejectTimesheet(rejectFor.tsId, rejectReason.trim());
    showToast(`Shift rejected`);
    setRejectFor(null); setRejectReason("");
  }

  function submitAddLog() {
    if (!addLogFor || !addLogDate || !addLogCheckin || !addLogCheckout) {
      showToast("Fill all required fields"); return;
    }
    const checkinMs = new Date(`${addLogDate}T${addLogCheckin}`).getTime();
    const checkoutMs = new Date(`${addLogDate}T${addLogCheckout}`).getTime();
    if (isNaN(checkinMs) || isNaN(checkoutMs)) { showToast("Invalid time"); return; }
    if (checkoutMs <= checkinMs) { showToast("Check-out must be after check-in"); return; }
    const filled = addLogRows.filter((r) => r.hours > 0);
    adminAddTimeLog(addLogFor.id, addLogDate, checkinMs, checkoutMs, filled);
    showToast(`Time log added for ${addLogFor.name}`);
    setAddLogFor(null);
    setAddLogDate(""); setAddLogCheckin(""); setAddLogCheckout("");
    setAddLogRows([{ vertical: "", note: "", hours: 0 }]);
  }

  const openQueries = queries.filter((q) => q.status === "open");

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Team overview — ${dateLabel} IST`}
      actions={
        <Button variant="primary" size="sm" onClick={() => {
          setAddLogFor(employees[0] || null);
          setAddLogDate(todayIST);
          setAddLogCheckin("09:00");
          setAddLogCheckout("17:00");
          setAddLogRows([{ vertical: config.verticals[0] || "", note: "", hours: 0 }]);
        }}>
          + Add time log
        </Button>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total teachers"   value={workers.length} />
        <StatCard label="Submitted today"  value={submitted} color="var(--c-brand-dark)" />
        <StatCard label="Pending log"      value={pending}   color="#A32D2D" />
        <StatCard label="On leave"         value={onLeave}   color="#185FA5" />
        <StatCard label="Week off / hol."  value={off}       color="#854F0B" />
      </div>

      {adminUnread.length > 0 && (
        <div style={{ background: "#EEEDFE", border: "0.5px solid var(--c-brand-border)", borderRadius: "var(--r-md)", padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--c-brand-dark)", fontWeight: 600 }}>
            {adminUnread.length} new notification{adminUnread.length === 1 ? "" : "s"} — employee {adminUnread.length === 1 ? "reply" : "replies"} on queries
          </span>
          <Button size="xs" onClick={() => markNotificationsRead("admin")}>Dismiss</Button>
        </div>
      )}

      {openQueries.length > 0 && (
        <>
          <SectionLabel mt={0}>Open queries ({openQueries.length})</SectionLabel>
          {openQueries.map((q) => {
            const emp = employees.find((e) => e.id === q.employeeId);
            const ts = timesheets.find((t) => t.id === q.timesheetId);
            const messages = q.messages?.length
              ? q.messages
              : [{ id: q.id, role: "admin" as const, actorName: q.byActorName, text: q.question, createdAt: q.createdAt }];
            const lastIsEmployee = messages[messages.length - 1]?.role === "employee";
            const isReplying = replyFor === q.id;
            return (
              <Card key={q.id}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: 13 }}>{emp?.name || q.employeeId}</strong>
                  <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>re: {ts?.date || "—"} · {fmtIST(q.createdAt)}</span>
                  {lastIsEmployee && <Chip label="Replied" variant="blue" tiny />}
                </div>

                {/* Message thread */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {messages.map((msg) => {
                    const isAdmin = msg.role === "admin";
                    return (
                      <div key={msg.id} style={{
                        alignSelf: isAdmin ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        background: isAdmin ? "var(--c-brand-light)" : "var(--c-bg)",
                        border: `0.5px solid ${isAdmin ? "var(--c-brand-border)" : "var(--c-border)"}`,
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

                {/* Reply / resolve */}
                {isReplying ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply…"
                      autoFocus
                      style={{ flex: 1, minHeight: 64, padding: 8, fontSize: 12, border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)", fontFamily: "inherit", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Button variant="primary" size="sm" onClick={() => {
                        if (!replyText.trim()) return;
                        addQueryMessage(q.id, "admin", replyText.trim());
                        setReplyFor(null); setReplyText("");
                        showToast("Reply sent");
                      }}>Send</Button>
                      <Button size="sm" onClick={() => { setReplyFor(null); setReplyText(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="xs" onClick={() => { setReplyFor(q.id); setReplyText(""); }}>↩ Reply</Button>
                    <Button size="xs" variant="primary" onClick={() => { resolveQuery(q.id); showToast("Query resolved"); }}>✓ Resolve</Button>
                  </div>
                )}
              </Card>
            );
          })}
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
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {todayShifts.length > 0 && (
                          <Button size="xs" onClick={() => setExpanded(isOpen ? null : e.id)}>
                            {isOpen ? "Hide ▲" : `${todayShifts.length} shift${todayShifts.length === 1 ? "" : "s"} ▼`}
                          </Button>
                        )}
                        <Button size="xs" onClick={() => {
                          setAddLogFor(e);
                          setAddLogDate(todayIST);
                          setAddLogCheckin("09:00");
                          setAddLogCheckout("17:00");
                          setAddLogRows([{ vertical: config.verticals[0] || "", note: "", hours: 0 }]);
                        }}>+ Log</Button>
                      </div>
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
                          onReset={() => setResetFor({ ts, empName: e.name })}
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

      {/* Query modal */}
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

      {/* Reset options modal */}
      {resetFor && (
        <Modal onClose={() => setResetFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Reset shift — {resetFor.empName}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 16 }}>Choose what to reset. The employee will be notified.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <ResetOption
              title="Reset check-in only"
              description="Clears the check-in time. Employee needs to clock in again."
              onClick={() => {
                resetCheckin(resetFor.ts.id);
                showToast(`Check-in reset for ${resetFor.empName}`);
                setResetFor(null);
              }}
            />
            <ResetOption
              title="Reset check-out only"
              description="Reverts the shift to in-progress. Employee needs to clock out again."
              onClick={() => {
                resetCheckout(resetFor.ts.id);
                showToast(`Check-out reset for ${resetFor.empName}`);
                setResetFor(null);
              }}
            />
            <ResetOption
              title="Reset both (full reset)"
              description="Permanently removes this shift record entirely."
              danger
              onClick={() => {
                resetShift(resetFor.ts.id);
                showToast(`Shift fully reset for ${resetFor.empName}`);
                setResetFor(null);
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setResetFor(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* Admin add time log modal */}
      {addLogFor && (
        <Modal onClose={() => setAddLogFor(null)}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Add time log manually</div>
          <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 14 }}>Add a time log on behalf of an employee for any date.</div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Employee *</label>
            <select
              value={addLogFor.id}
              onChange={(e) => setAddLogFor(employees.find((x) => x.id === e.target.value) || null)}
              style={{ width: "100%", marginBottom: 0 }}
            >
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Date *</label>
            <input type="date" value={addLogDate} onChange={(e) => setAddLogDate(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Check-in time *</label>
              <input type="time" value={addLogCheckin} onChange={(e) => setAddLogCheckin(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Check-out time *</label>
              <input type="time" value={addLogCheckout} onChange={(e) => setAddLogCheckout(e.target.value)} />
            </div>
          </div>

          {addLogCheckin && addLogCheckout && addLogDate && (
            <div style={{ fontSize: 11, color: "var(--c-brand-dark)", marginBottom: 12, padding: "6px 10px", background: "var(--c-brand-light)", borderRadius: "var(--r-sm)" }}>
              {(() => {
                const h = (new Date(`${addLogDate}T${addLogCheckout}`).getTime() - new Date(`${addLogDate}T${addLogCheckin}`).getTime()) / 3600000;
                return h > 0 ? `${h.toFixed(2)}h will be captured` : "⚠ Check-out must be after check-in";
              })()}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Breakdown (optional)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 70px 28px", gap: 6, marginBottom: 4 }}>
              {["Vertical", "Note", "Hrs", ""].map((h) => (
                <span key={h} style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 500, textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
            {addLogRows.map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 70px 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <select value={row.vertical} onChange={(e) => setAddLogRows((r) => r.map((x, i) => i === ri ? { ...x, vertical: e.target.value } : x))}>
                  <option value="">—</option>
                  {config.verticals.map((v) => <option key={v}>{v}</option>)}
                </select>
                <input type="text" value={row.note} placeholder="Description…" onChange={(e) => setAddLogRows((r) => r.map((x, i) => i === ri ? { ...x, note: e.target.value } : x))} />
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

function ResetOption({ title, description, danger, onClick }: {
  title: string; description: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer",
        border: `0.5px solid ${danger ? "#F09595" : "var(--c-border-strong)"}`,
        background: danger ? "#FEF6F6" : "var(--c-bg)",
        fontFamily: "var(--font-body)", transition: "all 0.1s",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? "#A32D2D" : "var(--c-text)", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: danger ? "#A32D2D" : "var(--c-text-3)", opacity: 0.8 }}>{description}</div>
    </button>
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
          {rejected && <Button size="xs" onClick={onReverse}>↩ Reverse</Button>}
          <Button size="xs" variant="danger" onClick={onReset}>Reset…</Button>
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
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
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

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4,
};
