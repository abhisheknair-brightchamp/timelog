"use client";
// src/components/admin/Dashboard.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, StatCard, Avatar, Chip, DayChip, SectionLabel, Card, Button, showToast } from "@/components/ui";
import { getDayStatus, todayInTz, tzByIana, fmtIST } from "@/lib/utils";
import type { Employee } from "@/types";

export default function Dashboard() {
  const { employees, holidays, timesheets, leaves, queries, createQuery, respondQuery, resolveQuery } = useStore((s) => ({
    employees: s.employees,
    holidays: s.holidays,
    timesheets: s.timesheets,
    leaves: s.leaves,
    queries: s.queries,
    createQuery: s.createQuery,
    respondQuery: s.respondQuery,
    resolveQuery: s.resolveQuery,
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

  function submitNewQuery() {
    if (!queryFor || !queryText.trim()) { showToast("Enter a question"); return; }
    createQuery(queryFor.tsId, queryFor.empId, queryText.trim());
    showToast(`Query sent to ${queryFor.empName}`);
    setQueryFor(null);
    setQueryText("");
  }

  const openQueries = queries.filter((q) => q.status === "open");
  const pendingResponse = openQueries.filter((q) => !q.response);
  const awaitingResolve = openQueries.filter((q) => q.response);

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
                  {q.response && (
                    <Button size="xs" onClick={() => { resolveQuery(q.id); showToast("Query resolved"); }}>Mark resolved</Button>
                  )}
                  {!q.response && (
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>Awaiting employee reply</span>
                  )}
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
              <th style={{ width: "18%" }}>Verticals</th>
              <th style={{ width: "6%" }}>TZ</th>
              <th style={{ width: "12%" }}>Status</th>
              <th style={{ width: "16%" }}>Hours</th>
              <th style={{ width: "16%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((e, i) => {
              const status = getStatus(e);
              const ts  = timesheets.find((t) => t.employeeId === e.id && t.date === todayIST);
              const lv  = leaves.find((l) => l.employeeId === e.id && l.date === todayIST);
              const hrs = ts ? ts.totalHours : 0;
              const tz  = tzByIana(e.timezone);
              return (
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
                  <td>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {e.verticals.slice(0, 2).map((v) => (
                        <Chip key={v} label={v} variant="purple" tiny />
                      ))}
                      {e.verticals.length > 2 && (
                        <span style={{ fontSize: 10, color: "var(--c-text-3)" }}>+{e.verticals.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td><span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{tz.short}</span></td>
                  <td><DayChip status={status} /></td>
                  <td>
                    {status === "logged" ? (
                      <div>
                        <div>
                          <span style={{ fontWeight: 500, color: "var(--c-brand-dark)" }}>{hrs.toFixed(1)}h</span>
                          <span style={{ fontSize: 11, color: "var(--c-text-3)", marginLeft: 4 }}>/ {e.minHoursPerDay}h target</span>
                        </div>
                        {typeof ts?.capturedHours === "number" && (
                          <div style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 2 }}>
                            {ts.capturedHours.toFixed(2)}h captured
                          </div>
                        )}
                      </div>
                    ) : status === "in-progress" && ts?.startedAt ? (
                      <span style={{ fontSize: 11, color: "#3C3489" }}>
                        Clocked in {new Date(ts.startedAt).toLocaleTimeString("en-US", { timeZone: e.timezone, hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                    ) : status === "leave" ? (
                      <span style={{ fontSize: 11, color: "#185FA5" }}>
                        {lv ? lv.type.charAt(0).toUpperCase() + lv.type.slice(1) + " leave" : "On leave"}
                      </span>
                    ) : status === "weekoff" || status === "holiday" ? (
                      <span style={{ color: "var(--c-text-3)" }}>—</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>Not submitted</span>
                    )}
                  </td>
                  <td>
                    {ts && (
                      <Button size="xs" onClick={() => { setQueryFor({ tsId: ts.id, empId: e.id, empName: e.name }); setQueryText(""); }}>
                        ? Question
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {queryFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
             onClick={() => setQueryFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 480, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Question for {queryFor.empName}</div>
            <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 12 }}>They'll see this on their history page and can respond.</div>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. Hours seem off for Monday — can you double-check?"
              autoFocus
              style={{ width: "100%", minHeight: 80, padding: 10, fontSize: 13, border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)", fontFamily: "inherit", resize: "vertical", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" onClick={() => setQueryFor(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={submitNewQuery}>Send question</Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
