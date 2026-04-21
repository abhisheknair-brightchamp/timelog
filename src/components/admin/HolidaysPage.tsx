"use client";
// src/components/admin/HolidaysPage.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, SectionLabel, Card, Button, showToast } from "@/components/ui";

export function HolidaysPage() {
  const { holidays, addHoliday, removeHoliday } = useStore((s) => ({
    holidays: s.holidays, addHoliday: s.addHoliday, removeHoliday: s.removeHoliday,
  }));
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  function add() {
    if (!date || !name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast("Enter a valid date (YYYY-MM-DD) and name"); return; }
    addHoliday({ date, name: name.trim() }); setDate(""); setName(""); showToast(`${name} added`);
  }

  return (
    <PageShell title="Public holidays" subtitle="Org-wide — excluded from all timesheets automatically">
      <SectionLabel mt={0}>Holidays ({holidays.length})</SectionLabel>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {holidays.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "var(--c-bg)", borderRadius: "var(--r-sm)" }}>
              <span style={{ fontSize: 11, color: "var(--c-text-3)", minWidth: 80, fontVariantNumeric: "tabular-nums" }}>{h.date}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{h.name}</span>
              <span style={{ fontSize: 11, background: "#FAEEDA", color: "#854F0B", padding: "2px 8px", borderRadius: 999, fontWeight: 500 }}>Holiday</span>
              <Button size="xs" variant="danger" onClick={() => { removeHoliday(h.id); showToast("Removed"); }}>Remove</Button>
            </div>
          ))}
          {holidays.length === 0 && <div style={{ fontSize: 13, color: "var(--c-text-3)", padding: "8px 0" }}>No holidays configured yet</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" style={{ maxWidth: 140 }} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button variant="primary" onClick={add}>Add</Button>
        </div>
      </Card>
    </PageShell>
  );
}
export default HolidaysPage;

// ─── TeamView ─────────────────────────────────────────────────────────────────
import { Chip, Avatar} from "@/components/ui";

export function TeamView() {
  const { employees, config } = useStore((s) => ({ employees: s.employees, config: s.config }));

  return (
    <PageShell title="Team view" subtitle="Employees grouped by vertical">
      {config.verticals.map((v) => {
        const members = employees.filter((e) => e.verticals.includes(v));
        return (
          <div key={v}>
            <SectionLabel>{v} ({members.length})</SectionLabel>
            <Card>
              {members.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>No employees assigned</div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {members.map((e, i) => {
                    const idx = employees.indexOf(e);
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: "var(--c-bg)", borderRadius: "var(--r-md)", border: "0.5px solid var(--c-border)" }}>
                        <Avatar name={e.name} index={idx} size="sm" />
                        <span style={{ fontSize: 12 }}>{e.name}</span>
                        <Chip label={e.role} variant="green" tiny />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        );
      })}
    </PageShell>
  );
}

// ─── AuditLog ─────────────────────────────────────────────────────────────────
import { fmtIST } from "@/lib/utils";
import type { AuditType } from "@/types";

const TYPE_COLOR: Record<AuditType, { bg: string; color: string; label: string }> = {
  profile:   { bg: "#E6F1FB", color: "#185FA5", label: "Profile" },
  timesheet: { bg: "#E1F5EE", color: "#0F6E56", label: "Timesheet" },
  config:    { bg: "#FAEEDA", color: "#854F0B", label: "Config" },
  onboard:   { bg: "#EEEDFE", color: "#3C3489", label: "Onboard" },
};

export function AuditLog() {
  const auditLog = useStore((s) => s.auditLog);

  // Group by day (IST)
  const grouped: Record<string, typeof auditLog> = {};
  auditLog.forEach((a) => {
    const day = new Date(a.timestamp).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(a);
  });

  return (
    <PageShell title="Audit log" subtitle="Every change — timestamped and attributed to the acting account">
      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--c-text-3)", fontSize: 13 }}>No audit entries yet</div>
      )}
      {Object.entries(grouped).map(([day, entries]) => (
        <div key={day}>
          <SectionLabel>{day}</SectionLabel>
          <Card>
            {entries.map((a) => {
              const tc = TYPE_COLOR[a.type];
              const timeIST = new Date(a.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <div key={a.id} style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: "0.5px solid var(--c-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--c-text-3)", minWidth: 90, flexShrink: 0, marginTop: 1, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)" }}>
                    {timeIST} IST
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{a.actorName}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 999, background: tc.bg, color: tc.color }}>{tc.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 3 }}>{a.action}</div>
                    {a.diff && a.diff.length > 0 && (
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                        {a.diff.map((d, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "var(--c-text-3)", minWidth: 60, fontFamily: "var(--font-mono)" }}>{d.field}</span>
                            <span style={{ textDecoration: "line-through", color: "var(--c-text-3)", fontSize: 11 }}>{d.from}</span>
                            <span style={{ color: "var(--c-text-3)", fontSize: 10 }}>→</span>
                            <span style={{ color: "#0F6E56", fontSize: 11, fontWeight: 500 }}>{d.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </PageShell>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { config, updateConfig } = useStore((s) => ({ config: s.config, updateConfig: s.updateConfig }));
  const [url, setUrl] = useState(config.sheetsUrl);

  function save() {
    updateConfig({ sheetsUrl: url.trim() });
    showToast("Google Sheets URL saved");
  }

  return (
    <PageShell title="Settings" subtitle="Connect to Google Sheets backend">
      <SectionLabel mt={0}>Google Sheets integration</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: "var(--c-text-2)", marginBottom: 14 }}>
          All timesheet submissions and audit entries will be synced to your Google Sheet in real time. Deploy the Apps Script Web App first, then paste the URL below.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--c-text-2)" }}>Apps Script Web App URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>
        <Button variant="primary" onClick={save}>Save URL</Button>
        {config.sheetsUrl && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--c-brand-dark)" }}>
            ✓ Connected — {config.sheetsUrl.slice(0, 60)}…
          </div>
        )}
      </Card>
    </PageShell>
  );
}
