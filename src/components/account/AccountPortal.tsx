"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { PageShell, SectionLabel, Card, Button, InfoBanner, Chip, showToast, Toast } from "@/components/ui";
import { TIMEZONES, dayName, initials, empColor, nowInTz } from "@/lib/utils";
import type { LeaveType } from "@/types";

const DEMO_EMP_ID = "e1";

export default function AccountPortal() {
  const [page, setPage] = useState("profile");
  useEffect(() => {
    const handler = (e: Event) => setPage((e as CustomEvent).detail);
    window.addEventListener("tl:page", handler);
    return () => window.removeEventListener("tl:page", handler);
  }, []);
  return (
    <>
      {page === "profile" && <ProfilePage />}
      {page === "weekoffs" && <SchedulePage />}
      <Toast />
    </>
  );
}

function ProfilePage() {
  const { employees, updateEmployee } = useStore((s) => ({
    employees: s.employees,
    updateEmployee: s.updateEmployee,
  }));
  const emp = employees.find((e) => e.id === DEMO_EMP_ID)!;
  const empIdx = employees.findIndex((e) => e.id === DEMO_EMP_ID);
  const c = empColor(empIdx);
  const [name, setName] = useState(emp.name);
  const [email, setEmail] = useState(emp.email);
  const [tz, setTz] = useState(emp.timezone);
  const [localNow, setLocalNow] = useState("");
  const [istNow, setIstNow] = useState("");
  useEffect(() => {
    function tick() {
      const fmt = (iana: string) =>
        nowInTz(iana).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setLocalNow(fmt(tz));
      setIstNow(fmt("Asia/Kolkata"));
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tz]);
  const tzInfo = TIMEZONES.find((t) => t.iana === tz) || TIMEZONES[0];
  function saveProfile() {
    if (!name.trim() || !email.trim()) { showToast("Name and email cannot be empty"); return; }
    updateEmployee(emp.id, { name: name.trim(), email: email.trim() }, DEMO_EMP_ID);
    showToast("Profile saved");
  }
  function saveTz() {
    updateEmployee(emp.id, { timezone: tz }, DEMO_EMP_ID);
    showToast("Timezone saved — " + tzInfo.label);
  }
  return (
    <PageShell title="Profile & timezone" subtitle="Your account settings — timezone saves once and applies everywhere">
      <InfoBanner>Your timezone is set here once and auto-applied to every timesheet. You never need to re-select it.</InfoBanner>
      <SectionLabel mt={0}>Identity</SectionLabel>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, paddingBottom: 16, borderBottom: "0.5px solid var(--c-border)" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: c.bg, color: c.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600 }}>
            {initials(emp.name)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{emp.name}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <Chip label={emp.role} variant="green" />
              {emp.verticals.map((v) => <Chip key={v} label={v} variant="purple" tiny />)}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Role"><input value={emp.role} disabled /></Field>
          <Field label="Min hours / day"><input value={emp.minHoursPerDay + "h"} disabled /></Field>
        </div>
        <Button variant="primary" onClick={saveProfile}>Save profile</Button>
      </Card>
      <SectionLabel>Timezone</SectionLabel>
      <Card>
        <Field label="Your timezone" mb={14}>
          <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ maxWidth: 340 }}>
            {TIMEZONES.map((t) => <option key={t.iana} value={t.iana}>{t.label}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <ClockBox label={"Your time (" + tzInfo.short + ")"} time={localNow} highlight />
          <ClockBox label="Admin time (IST)" time={istNow} />
        </div>
        <Button variant="primary" onClick={saveTz}>Save timezone</Button>
      </Card>
      <SectionLabel>Verticals</SectionLabel>
      <Card>
        <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 10 }}>Verticals are assigned by admin.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {emp.verticals.length
            ? emp.verticals.map((v) => <Chip key={v} label={v} variant="purple" />)
            : <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>No verticals assigned yet</span>}
        </div>
      </Card>
    </PageShell>
  );
}

function SchedulePage() {
  const { employees, holidays, leaves } = useStore((s) => ({
    employees: s.employees, holidays: s.holidays, leaves: s.leaves,
  }));
  const emp = employees.find((e) => e.id === DEMO_EMP_ID)!;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.filter((h) => h.date >= today).slice(0, 6);
  const myLeaves = leaves.filter((l) => l.employeeId === DEMO_EMP_ID);
  const LEAVE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    sick:   { bg: "#FCEBEB", color: "#A32D2D", label: "Sick leave" },
    annual: { bg: "#E6F1FB", color: "#185FA5", label: "Annual leave" },
    other:  { bg: "#F1EFE8", color: "#5F5E5A", label: "Other" },
  };
  return (
    <PageShell title="Schedule & leaves" subtitle="Your work schedule, holidays, and leave history">
      <InfoBanner>Week off days are set by admin. To apply or cancel leaves, go to <strong>Timesheet → My leaves</strong>.</InfoBanner>
      <SectionLabel mt={0}>Your weekly schedule</SectionLabel>
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[0,1,2,3,4,5,6].map((d) => {
            const isOff = emp.weekoffs.includes(d);
            return (
              <div key={d} style={{ textAlign: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, background: isOff ? "#E1F5EE" : "var(--c-bg)", color: isOff ? "#0F6E56" : "var(--c-text-2)", border: "0.5px solid " + (isOff ? "#9FE1CB" : "var(--c-border-strong)") }}>
                  {dayName(d)}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: isOff ? "#0F6E56" : "var(--c-text-3)" }}>{isOff ? "Off" : "Work"}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "var(--c-text-2)" }}>
          Working days: {[0,1,2,3,4,5,6].filter((d) => !emp.weekoffs.includes(d)).map(dayName).join(", ")}
        </div>
      </Card>
      <SectionLabel>Upcoming public holidays</SectionLabel>
      <Card>
        {upcoming.length === 0
          ? <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>No upcoming holidays</div>
          : upcoming.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "0.5px solid var(--c-border)" }}>
              <span style={{ fontSize: 11, color: "var(--c-text-3)", minWidth: 90 }}>{h.date}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{h.name}</span>
              <Chip label="Holiday" variant="amber" />
            </div>
          ))}
      </Card>
      <SectionLabel>My leave history</SectionLabel>
      <Card>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {(["sick", "annual", "other"] as const).map((t) => {
            const count = myLeaves.filter((l) => l.type === t).length;
            const lc = LEAVE_COLORS[t];
            return (
              <div key={t} style={{ background: lc.bg, borderRadius: "var(--r-md)", padding: "8px 14px", minWidth: 80, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: lc.color }}>{count}</div>
                <div style={{ fontSize: 10, color: lc.color, opacity: 0.8, marginTop: 2 }}>{lc.label}</div>
              </div>
            );
          })}
        </div>
        {myLeaves.length === 0
          ? <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>No leaves on record</div>
          : myLeaves.sort((a, b) => b.date.localeCompare(a.date)).map((l) => {
            const lc = LEAVE_COLORS[l.type];
            const dl = new Date(l.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "0.5px solid var(--c-border)" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: lc.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--c-text-2)", minWidth: 130 }}>{dl}</span>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: lc.bg, color: lc.color }}>{lc.label}</span>
                <span style={{ fontSize: 12, color: "var(--c-text-3)", flex: 1 }}>{l.note || "—"}</span>
              </div>
            );
          })}
      </Card>
    </PageShell>
  );
}

function Field({ label, children, mb }: { label: string; children: React.ReactNode; mb?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: mb ?? 0 }}>
      <label style={{ fontSize: 11, color: "var(--c-text-2)" }}>{label}</label>
      {children}
    </div>
  );
}

function ClockBox({ label, time, highlight }: { label: string; time: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? "#E1F5EE" : "var(--c-bg)", borderRadius: "var(--r-md)", padding: "10px 18px", minWidth: 150 }}>
      <div style={{ fontSize: 10, color: highlight ? "#0F6E56" : "var(--c-text-3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: highlight ? "#0F6E56" : "var(--c-text-2)", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)" }}>{time}</div>
    </div>
  );
}
