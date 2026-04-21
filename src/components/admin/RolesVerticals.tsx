"use client";
// src/components/admin/RolesVerticals.tsx
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageShell, SectionLabel, Card, Button, Chip, InfoBanner, showToast } from "@/components/ui";

export default function RolesVerticals() {
  const { config, employees, addRole, removeRole, addVertical, removeVertical } = useStore((s) => ({
    config: s.config, employees: s.employees,
    addRole: s.addRole, removeRole: s.removeRole,
    addVertical: s.addVertical, removeVertical: s.removeVertical,
  }));

  const [newRole, setNewRole] = useState("");
  const [newVert, setNewVert] = useState("");

  function handleAddRole() {
    const r = newRole.trim();
    if (!r) { showToast("Enter a role name"); return; }
    if (config.roles.includes(r)) { showToast("Role already exists"); return; }
    addRole(r); setNewRole(""); showToast(`Role "${r}" added`);
  }
  function handleRemoveRole(r: string) {
    if (employees.some((e) => e.role === r)) { showToast("Cannot remove — employees assigned to this role"); return; }
    removeRole(r); showToast(`Role "${r}" removed`);
  }
  function handleAddVert() {
    const v = newVert.trim();
    if (!v) { showToast("Enter a vertical name"); return; }
    if (config.verticals.includes(v)) { showToast("Vertical already exists"); return; }
    addVertical(v); setNewVert(""); showToast(`Vertical "${v}" added`);
  }
  function handleRemoveVert(v: string) {
    removeVertical(v); showToast(`Vertical "${v}" removed — unassigned from all employees`);
  }

  return (
    <PageShell title="Roles & verticals" subtitle="Manage your organisation's structure">
      <SectionLabel mt={0}>Roles</SectionLabel>
      <Card>
        <InfoBanner>Each employee has exactly one role. Cannot remove a role that has active employees.</InfoBanner>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {config.roles.map((r) => (
            <div key={r} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#E1F5EE", color: "#0F6E56", border: "0.5px solid #9FE1CB", borderRadius: 999, padding: "3px 8px 3px 12px", fontSize: 12, fontWeight: 500 }}>
              {r}
              <button
                onClick={() => handleRemoveRole(r)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, color: "#0F6E56", opacity: 0.6, padding: "0 2px" }}
              >×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New role e.g. Mentor" onKeyDown={(e) => e.key === "Enter" && handleAddRole()} style={{ maxWidth: 220 }} />
          <Button variant="primary" onClick={handleAddRole}>Add role</Button>
        </div>
      </Card>

      <SectionLabel>Verticals</SectionLabel>
      <Card>
        <InfoBanner>Verticals are subject areas / programmes. Employees can belong to multiple verticals. Removing a vertical unassigns it from all employees.</InfoBanner>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {config.verticals.map((v) => (
            <div key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #AFA9EC", borderRadius: 999, padding: "3px 8px 3px 12px", fontSize: 12, fontWeight: 500 }}>
              {v}
              <button
                onClick={() => handleRemoveVert(v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, color: "#3C3489", opacity: 0.6, padding: "0 2px" }}
              >×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newVert} onChange={(e) => setNewVert(e.target.value)} placeholder="New vertical e.g. Science" onKeyDown={(e) => e.key === "Enter" && handleAddVert()} style={{ maxWidth: 220 }} />
          <Button variant="primary" onClick={handleAddVert}>Add vertical</Button>
        </div>
      </Card>

      <SectionLabel>Role × vertical coverage</SectionLabel>
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ tableLayout: "auto", minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ paddingRight: 16, minWidth: 110 }}>Role</th>
                {config.verticals.map((v) => (
                  <th key={v} style={{ textAlign: "center", paddingLeft: 8, paddingRight: 8 }}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.roles.map((r) => {
                const members = employees.filter((e) => e.role === r);
                return (
                  <tr key={r}>
                    <td style={{ paddingRight: 16 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Chip label={r} variant="green" />
                        <span style={{ fontSize: 10, color: "var(--c-text-3)" }}>{members.length} staff</span>
                      </span>
                    </td>
                    {config.verticals.map((v) => {
                      const count = employees.filter((e) => e.role === r && e.verticals.includes(v)).length;
                      return (
                        <td key={v} style={{ textAlign: "center" }}>
                          {count > 0
                            ? <span style={{ fontWeight: 500, color: "var(--c-brand-dark)", fontSize: 13 }}>{count}</span>
                            : <span style={{ color: "var(--c-text-3)", fontSize: 11 }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}
