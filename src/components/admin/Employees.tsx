"use client";
// src/components/admin/Employees.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, Avatar, Chip, SectionLabel, Card, Button, TagPill, InfoBanner, showToast } from "@/components/ui";
import { TIMEZONES, dayName, empColor } from "@/lib/utils";
import type { Employee } from "@/types";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

type FormData = {
  name: string; email: string; role: string; verticals: string[];
  timezone: string; weekoffs: number[]; minHoursPerDay: number;
};
const emptyForm = (): FormData => ({
  name: "", email: "", role: "Instructor", verticals: [],
  timezone: "Asia/Kolkata", weekoffs: [6], minHoursPerDay: 8,
});

export default function Employees() {
  const { employees, config, addEmployee, updateEmployee, currentEmployeeId } = useStore((s) => ({
    employees: s.employees, config: s.config,
    addEmployee: s.addEmployee, updateEmployee: s.updateEmployee,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [accountFor, setAccountFor] = useState<Employee | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  function openAdd() { setForm(emptyForm()); setEditId(null); setShowForm(true); }
  function openEdit(e: Employee) {
    setForm({ name: e.name, email: e.email, role: e.role, verticals: [...e.verticals], timezone: e.timezone, weekoffs: [...e.weekoffs], minHoursPerDay: e.minHoursPerDay });
    setEditId(e.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  function save() {
    if (!form.name.trim() || !form.email.trim()) { showToast("Name and email are required"); return; }
    if (!form.role) { showToast("Please select a role"); return; }
    if (editId) {
      updateEmployee(editId, { name: form.name, email: form.email, role: form.role, verticals: form.verticals, timezone: form.timezone, weekoffs: form.weekoffs, minHoursPerDay: form.minHoursPerDay }, currentEmployeeId);
      showToast("Changes saved");
    } else {
      addEmployee({ name: form.name, email: form.email, role: form.role, verticals: form.verticals, timezone: form.timezone, weekoffs: form.weekoffs, minHoursPerDay: form.minHoursPerDay, active: true });
      showToast(`${form.name} added`);
    }
    closeForm();
  }

  function toggleWO(d: number) {
    setForm((f) => ({ ...f, weekoffs: f.weekoffs.includes(d) ? f.weekoffs.filter((x) => x !== d) : [...f.weekoffs, d] }));
  }
  function toggleVert(v: string) {
    setForm((f) => ({ ...f, verticals: f.verticals.includes(v) ? f.verticals.filter((x) => x !== v) : [...f.verticals, v] }));
  }

  async function handleCreateAccount() {
    if (!accountFor || !tempPassword) return;
    if (tempPassword.length < 6) { showToast("Password must be at least 6 characters"); return; }
    setAccountLoading(true);
    try {
      const res = await fetch("/api/auth/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountFor.email, tempPassword, employeeId: accountFor.id }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Account created for ${accountFor.name}`);
        setAccountFor(null);
        setTempPassword("");
      } else {
        showToast(data.error || "Failed to create account");
      }
    } catch {
      showToast("Network error");
    } finally {
      setAccountLoading(false);
    }
  }

  return (
    <PageShell
      title="Employees"
      subtitle="Onboard and manage your team"
      actions={<Button variant="primary" onClick={openAdd}>+ Add employee</Button>}
    >
      {/* Set Password Modal */}
      {accountFor && (
        <Card highlight>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            Set temp password for <strong>{accountFor.name}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 12 }}>
            Employee will be prompted to change this on first login.
          </div>
          <Field label="Temporary password (min 6 chars)">
            <input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="e.g. Welcome@123"
              autoFocus
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button variant="primary" size="sm" onClick={handleCreateAccount} disabled={accountLoading}>
              {accountLoading ? "Creating…" : "Create Account"}
            </Button>
            <Button size="sm" onClick={() => { setAccountFor(null); setTempPassword(""); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card highlight>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            {editId ? "Edit employee" : "Add new employee"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="Full name *">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ravi Kumar" />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ravi@company.in" />
            </Field>
            <Field label="Min hours / day">
              <input type="number" value={form.minHoursPerDay} min={1} max={14} onChange={(e) => setForm((f) => ({ ...f, minHoursPerDay: +e.target.value || 8 }))} style={{ width: 80 }} />
            </Field>
            <Field label="Timezone">
              <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
                {TIMEZONES.map((t) => <option key={t.iana} value={t.iana}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Role * — select one" mb={12}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {config.roles.map((r) => (
                <TagPill key={r} label={r} selected={form.role === r} type="role" onClick={() => setForm((f) => ({ ...f, role: r }))} />
              ))}
            </div>
          </Field>

          <Field label="Verticals — select all that apply" mb={12}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {config.verticals.map((v) => (
                <TagPill key={v} label={v} selected={form.verticals.includes(v)} type="vert" onClick={() => toggleVert(v)} />
              ))}
            </div>
          </Field>

          <Field label="Week off days" mb={14}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleWO(d)}
                  style={{
                    width: 36, height: 36, borderRadius: "var(--r-sm)", fontSize: 11, fontWeight: 500, cursor: "pointer",
                    border: "0.5px solid", fontFamily: "var(--font-body)",
                    background: form.weekoffs.includes(d) ? "#E1F5EE" : "var(--c-bg)",
                    color: form.weekoffs.includes(d) ? "#0F6E56" : "var(--c-text-2)",
                    borderColor: form.weekoffs.includes(d) ? "#9FE1CB" : "var(--c-border-strong)",
                  }}
                >
                  {dayName(d)}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={save}>{editId ? "Save changes" : "Add employee"}</Button>
            <Button onClick={closeForm}>Cancel</Button>
          </div>
        </Card>
      )}

      <SectionLabel mt={showForm ? 20 : 0}>All employees ({employees.length})</SectionLabel>
      <Card>
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "24%" }}>Name</th>
              <th style={{ width: "11%" }}>Role</th>
              <th style={{ width: "20%" }}>Verticals</th>
              <th style={{ width: "13%" }}>Week offs</th>
              <th style={{ width: "8%" }}>Min hrs</th>
              <th style={{ width: "6%" }}>TZ</th>
              <th style={{ width: "18%" }}></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e, i) => (
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
                    {e.verticals.map((v) => <Chip key={v} label={v} variant="purple" tiny />)}
                    {e.verticals.length === 0 && <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>none</span>}
                  </div>
                </td>
                <td style={{ fontSize: 11, color: "var(--c-text-2)" }}>
                  {e.weekoffs.map((d) => dayName(d)).join(", ")}
                </td>
                <td style={{ fontSize: 12 }}>{e.minHoursPerDay}h/day</td>
                <td style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                  {TIMEZONES.find((t) => t.iana === e.timezone)?.short || "IST"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Button size="xs" onClick={() => openEdit(e)}>Edit</Button>
                    <Button size="xs" onClick={() => { setAccountFor(e); setTempPassword(""); }}>Set pwd</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
