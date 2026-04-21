"use client";
// src/components/admin/Analytics.tsx
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { PageShell, Card, SectionLabel, Avatar, Chip, StatCard, InfoBanner } from "@/components/ui";
import { tzByIana, getDayOfWeek, FIRST_USAGE_DATE, getShiftHours, sumShiftHours } from "@/lib/utils";

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  // Iterate in UTC to keep YYYY-MM-DD strings stable regardless of browser tz.
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = Date.UTC(ty, tm - 1, td);
  let cur = Date.UTC(fy, fm - 1, fd);
  while (cur <= end) {
    const dt = new Date(cur);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur += 24 * 60 * 60 * 1000;
  }
  return out;
}

function localDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampFrom(d: string) {
  return d < FIRST_USAGE_DATE ? FIRST_USAGE_DATE : d;
}

export default function Analytics() {
  const { employees, timesheets, leaves, holidays } = useStore((s) => ({
    employees: s.employees,
    timesheets: s.timesheets,
    leaves: s.leaves,
    holidays: s.holidays,
  }));

  const todayStr = localDateStr(Date.now());

  // Default: from FIRST_USAGE_DATE (or thirty days ago, whichever is later) to today
  const defaultFrom = clampFrom(localDateStr(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayStr);

  const effectiveFrom = clampFrom(from);
  const clampedFrom = from < FIRST_USAGE_DATE;
  const rangeDates = useMemo(() => dateRange(effectiveFrom, to), [effectiveFrom, to]);

  const rows = useMemo(() => employees.map((e) => {
    let logged = 0;
    let missed = 0;
    let weekoffs = 0;
    let holidayCount = 0;
    let leaveCount = 0;
    let acceptedHours = 0;
    let rejectedShifts = 0;
    let totalShifts = 0;

    rangeDates.forEach((d) => {
      const dow = getDayOfWeek(d);
      const isWeekoff = e.weekoffs.includes(dow);
      const isHoliday = holidays.some((h) => h.date === d);
      const leave = leaves.find((l) => l.employeeId === e.id && l.date === d);
      const dayShifts = timesheets.filter((t) => t.employeeId === e.id && t.date === d && t.submitted);
      const accepted = dayShifts.filter((t) => t.status !== "rejected");
      const rejected = dayShifts.filter((t) => t.status === "rejected");

      if (isWeekoff) { weekoffs++; return; }
      if (isHoliday) { holidayCount++; return; }
      if (leave) { leaveCount++; return; }
      if (accepted.length > 0) {
        logged++;
        acceptedHours += sumShiftHours(accepted);
        totalShifts += accepted.length;
        rejectedShifts += rejected.length;
        return;
      }
      if (rejected.length > 0) {
        // All shifts that day were rejected — counts as missed
        rejectedShifts += rejected.length;
        missed++;
        return;
      }
      if (d < todayStr) missed++;
    });

    return { emp: e, acceptedHours, logged, missed, weekoffs, leaveCount, holidayCount, rejectedShifts, totalShifts };
  }), [employees, timesheets, leaves, holidays, rangeDates, todayStr]);

  const totalAcceptedHours = rows.reduce((a, r) => a + r.acceptedHours, 0);
  const totalLogged = rows.reduce((a, r) => a + r.logged, 0);
  const totalMissed = rows.reduce((a, r) => a + r.missed, 0);
  const totalRejected = rows.reduce((a, r) => a + r.rejectedShifts, 0);
  const totalShifts = rows.reduce((a, r) => a + r.totalShifts, 0);

  function setPreset(days: number) {
    const d = clampFrom(localDateStr(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    setFrom(d); setTo(todayStr);
  }

  function setThisMonth() {
    const now = new Date();
    const first = clampFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setFrom(first); setTo(todayStr);
  }

  const rangeLabel = `${rangeDates.length} day${rangeDates.length === 1 ? "" : "s"}`;

  return (
    <PageShell title="Analytics" subtitle={`Date-range overview — ${effectiveFrom} to ${to} (${rangeLabel})`}>

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>From</label>
            <input type="date" value={from} min={FIRST_USAGE_DATE} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--c-text-2)", display: "block", marginBottom: 4 }}>To</label>
            <input type="date" value={to} min={effectiveFrom} max={todayStr} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button onClick={() => setPreset(7)} style={presetBtn}>Last 7 days</button>
            <button onClick={() => setPreset(30)} style={presetBtn}>Last 30 days</button>
            <button onClick={setThisMonth} style={presetBtn}>This month</button>
          </div>
        </div>
      </Card>

      {clampedFrom && (
        <InfoBanner>
          System went live on <strong>{FIRST_USAGE_DATE}</strong> — earlier dates are excluded from the range.
        </InfoBanner>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Hours accepted" value={totalAcceptedHours.toFixed(1) + "h"} color="var(--c-brand-dark)" />
        <StatCard label="Shifts"         value={totalShifts} />
        <StatCard label="Days logged"    value={totalLogged} />
        <StatCard label="Days missed"    value={totalMissed} color={totalMissed > 0 ? "#A32D2D" : undefined} />
        <StatCard label="Shifts rejected" value={totalRejected} color={totalRejected > 0 ? "#A32D2D" : undefined} />
      </div>

      <SectionLabel mt={0}>Per employee</SectionLabel>
      <Card>
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Employee</th>
              <th style={{ width: "10%" }}>Role</th>
              <th style={{ width: "6%" }}>TZ</th>
              <th style={{ width: "14%" }}>Accepted hrs</th>
              <th style={{ width: "8%" }}>Shifts</th>
              <th style={{ width: "8%" }}>Days</th>
              <th style={{ width: "8%" }}>Missed</th>
              <th style={{ width: "8%" }}>Rejected</th>
              <th style={{ width: "8%" }}>Leaves</th>
              <th style={{ width: "8%" }}>Holidays</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tz = tzByIana(r.emp.timezone);
              const avg = r.logged > 0 ? r.acceptedHours / r.logged : 0;
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
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-brand-dark)" }}>{r.acceptedHours.toFixed(2)}h</span>
                    {r.logged > 0 && (
                      <span style={{ fontSize: 10, color: "var(--c-text-3)", marginLeft: 6 }}>avg {avg.toFixed(1)}h</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.totalShifts}</td>
                  <td style={{ fontSize: 13 }}>{r.logged}</td>
                  <td style={{ fontSize: 13, color: r.missed > 0 ? "#A32D2D" : "var(--c-text-3)" }}>{r.missed}</td>
                  <td style={{ fontSize: 13, color: r.rejectedShifts > 0 ? "#A32D2D" : "var(--c-text-3)" }}>{r.rejectedShifts}</td>
                  <td style={{ fontSize: 13 }}>{r.leaveCount}</td>
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
