"use client";
// src/components/admin/Analytics.tsx
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { PageShell, Card, SectionLabel, Avatar, Chip, StatCard } from "@/components/ui";
import { tzByIana, getDayOfWeek } from "@/lib/utils";

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Analytics() {
  const { employees, timesheets, leaves, holidays } = useStore((s) => ({
    employees: s.employees,
    timesheets: s.timesheets,
    leaves: s.leaves,
    holidays: s.holidays,
  }));

  // Default: last 30 days ending today
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(todayStr);

  const rangeDates = useMemo(() => dateRange(from, to), [from, to]);

  const rows = useMemo(() => employees.map((e) => {
    let hours = 0;
    let logged = 0;
    let missed = 0;
    let weekoffs = 0;
    let holidayCount = 0;
    let leaveCount = 0;

    rangeDates.forEach((d) => {
      const dow = getDayOfWeek(d);
      const isWeekoff = e.weekoffs.includes(dow);
      const isHoliday = holidays.some((h) => h.date === d);
      const leave = leaves.find((l) => l.employeeId === e.id && l.date === d);
      const ts = timesheets.find((t) => t.employeeId === e.id && t.date === d && t.submitted);

      if (isWeekoff) { weekoffs++; return; }
      if (isHoliday) { holidayCount++; return; }
      if (leave) { leaveCount++; return; }
      if (ts) { logged++; hours += ts.totalHours; return; }
      // Only count "missed" if the date is in the past (not today, not future)
      if (d < todayStr) missed++;
    });

    return { emp: e, hours, logged, missed, weekoffs, leaveCount, holidayCount };
  }), [employees, timesheets, leaves, holidays, rangeDates, todayStr]);

  const totalHours = rows.reduce((a, r) => a + r.hours, 0);
  const totalLogged = rows.reduce((a, r) => a + r.logged, 0);
  const totalMissed = rows.reduce((a, r) => a + r.missed, 0);
  const totalLeaves = rows.reduce((a, r) => a + r.leaveCount, 0);

  function setPreset(days: number) {
    const d = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFrom(d); setTo(todayStr);
  }

  function setThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    setFrom(first); setTo(todayStr);
  }

  const rangeLabel = `${rangeDates.length} day${rangeDates.length === 1 ? "" : "s"}`;

  return (
    <PageShell title="Analytics" subtitle={`Date-range overview — ${from} to ${to} (${rangeLabel})`}>

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>To</label>
            <input type="date" value={to} min={from} max={todayStr} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button onClick={() => setPreset(7)} style={presetBtn}>Last 7 days</button>
            <button onClick={() => setPreset(30)} style={presetBtn}>Last 30 days</button>
            <button onClick={setThisMonth} style={presetBtn}>This month</button>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total hours worked" value={totalHours.toFixed(1) + "h"} color="var(--c-brand-dark)" />
        <StatCard label="Days logged"        value={totalLogged} />
        <StatCard label="Days missed"        value={totalMissed} color="#A32D2D" />
        <StatCard label="Leaves taken"       value={totalLeaves} color="#185FA5" />
      </div>

      <SectionLabel mt={0}>Per employee</SectionLabel>
      <Card>
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "24%" }}>Employee</th>
              <th style={{ width: "10%" }}>Role</th>
              <th style={{ width: "8%" }}>TZ</th>
              <th style={{ width: "14%" }}>Hours</th>
              <th style={{ width: "10%" }}>Logged</th>
              <th style={{ width: "10%" }}>Missed</th>
              <th style={{ width: "8%" }}>Leaves</th>
              <th style={{ width: "8%" }}>Week off</th>
              <th style={{ width: "8%" }}>Holidays</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tz = tzByIana(r.emp.timezone);
              const below = r.logged > 0 && (r.hours / r.logged) < r.emp.minHoursPerDay;
              return (
                <tr key={r.emp.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Avatar name={r.emp.name} index={i} />
                      <div>
                        <div style={{ fontSize: 13 }}>{r.emp.name}</div>
                        <div style={{ fontSize: 10, color: "var(--c-text-3)" }}>{r.emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><Chip label={r.emp.role} variant="green" tiny /></td>
                  <td style={{ fontSize: 11, color: "var(--c-text-3)" }}>{tz.short}</td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-brand-dark)" }}>{r.hours.toFixed(1)}h</span>
                    {r.logged > 0 && (
                      <span style={{ fontSize: 10, color: below ? "#A32D2D" : "var(--c-text-3)", marginLeft: 6 }}>
                        avg {(r.hours / r.logged).toFixed(1)}h
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.logged}</td>
                  <td style={{ fontSize: 13, color: r.missed > 0 ? "#A32D2D" : "var(--c-text-3)" }}>{r.missed}</td>
                  <td style={{ fontSize: 13 }}>{r.leaveCount}</td>
                  <td style={{ fontSize: 13, color: "var(--c-text-3)" }}>{r.weekoffs}</td>
                  <td style={{ fontSize: 13, color: "var(--c-text-3)" }}>{r.holidayCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

const presetBtn: React.CSSProperties = {
  padding: "5px 11px", fontSize: 11, fontWeight: 500,
  border: "0.5px solid var(--c-border-strong)", borderRadius: "var(--r-sm)",
  background: "#fff", color: "var(--c-text-2)", cursor: "pointer",
  fontFamily: "var(--font-body)",
};
