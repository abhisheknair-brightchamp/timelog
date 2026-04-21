"use client";
// src/components/admin/Dashboard.tsx
import { useStore } from "@/lib/store";
import { PageShell, StatCard, Avatar, Chip, DayChip, SectionLabel, Card } from "@/components/ui";
import { getDayStatus, todayInTz, tzByIana } from "@/lib/utils";

export default function Dashboard() {
  const { employees, holidays, timesheets, leaves } = useStore((s) => ({
    employees: s.employees,
    holidays: s.holidays,
    timesheets: s.timesheets,
    leaves: s.leaves,
  }));

  const todayIST = todayInTz("Asia/Kolkata");
  const workers = employees;

  const getStatus = (e: typeof employees[0]) =>
    getDayStatus(e, todayIST, holidays, timesheets, todayIST, leaves);

  const submitted = workers.filter((e) => getStatus(e) === "logged").length;
  const pending   = workers.filter((e) => ["missing", "upcoming"].includes(getStatus(e))).length;
  const onLeave   = workers.filter((e) => getStatus(e) === "leave").length;
  const off       = workers.filter((e) => ["weekoff", "holiday"].includes(getStatus(e))).length;

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <PageShell title="Dashboard" subtitle={`Team overview — ${dateLabel} IST`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total teachers"   value={workers.length} />
        <StatCard label="Submitted today"  value={submitted} color="var(--c-brand-dark)" />
        <StatCard label="Pending log"      value={pending}   color="#A32D2D" />
        <StatCard label="On leave"         value={onLeave}   color="#185FA5" />
        <StatCard label="Week off / hol."  value={off}       color="#854F0B" />
      </div>

      <SectionLabel mt={0}>Today — all teachers</SectionLabel>
      <Card>
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "24%" }}>Teacher</th>
              <th style={{ width: "12%" }}>Role</th>
              <th style={{ width: "22%" }}>Verticals</th>
              <th style={{ width: "8%" }}>TZ</th>
              <th style={{ width: "14%" }}>Status</th>
              <th style={{ width: "20%" }}>Hours</th>
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
                      {e.verticals.slice(0, 3).map((v) => (
                        <Chip key={v} label={v} variant="purple" tiny />
                      ))}
                      {e.verticals.length > 3 && (
                        <span style={{ fontSize: 10, color: "var(--c-text-3)" }}>+{e.verticals.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td><span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{tz.short}</span></td>
                  <td><DayChip status={status} /></td>
                  <td>
                    {status === "logged" ? (
                      <span>
                        <span style={{ fontWeight: 500, color: "var(--c-brand-dark)" }}>{hrs.toFixed(1)}h</span>
                        <span style={{ fontSize: 11, color: "var(--c-text-3)", marginLeft: 4 }}>/ {e.minHoursPerDay}h min</span>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
