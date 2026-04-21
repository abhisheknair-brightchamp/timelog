"use client";
// src/components/ui/Sidebar.tsx
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { initials, empColor } from "@/lib/utils";
import type { Portal } from "@/types";

const NAV: Record<Portal, { id: string; label: string }[]> = {
  admin: [
    { id: "dashboard",  label: "Dashboard"        },
    { id: "analytics",  label: "Analytics"         },
    { id: "team",       label: "Team"              },
    { id: "employees",  label: "Employees"         },
    { id: "roles",      label: "Roles & verticals" },
    { id: "holidays",   label: "Holidays"          },
    { id: "auditlog",   label: "Audit log"         },
    { id: "settings",   label: "Settings"          },
  ],
  account: [
    { id: "profile",  label: "Profile & timezone" },
    { id: "weekoffs", label: "Schedule & leaves"  },
  ],
  timesheet: [
    { id: "log",     label: "Log today"  },
    { id: "history", label: "My history" },
    { id: "leaves",  label: "My leaves"  },
  ],
};

function emitPage(page: string) {
  (window as any).__tlPage = page;
  window.dispatchEvent(new CustomEvent("tl:page", { detail: page }));
}

export default function Sidebar() {
  const { portal, setPortal, employees, currentEmployeeId, currentEmail, logout } = useStore((s) => ({
    portal: s.portal,
    setPortal: s.setPortal,
    employees: s.employees,
    currentEmployeeId: s.currentEmployeeId,
    currentEmail: s.currentEmail,
    logout: s.logout,
  }));

  const [activePage, setActivePage] = useState(NAV[portal][0].id);

  useEffect(() => {
    const first = NAV[portal][0].id;
    setActivePage(first);
    emitPage(first);
  }, [portal]);

  useEffect(() => {
    const handler = (e: Event) => setActivePage((e as CustomEvent).detail);
    window.addEventListener("tl:page", handler);
    return () => window.removeEventListener("tl:page", handler);
  }, []);

  const isAdmin = currentEmployeeId === "admin";
  const emp = employees.find((e) => e.id === currentEmployeeId);
  const empIdx = employees.findIndex((e) => e.id === currentEmployeeId);
  const color = empColor(empIdx >= 0 ? empIdx : 0);
  const portals: Portal[] = ["admin", "account", "timesheet"];
  const portalLabels: Record<Portal, string> = { admin: "Admin", account: "Account", timesheet: "Sheet" };

  function handleLogout() {
    logout();
    if (typeof window !== "undefined") {
      const { clearSession } = require("@/lib/auth");
      clearSession();
      window.location.reload();
    }
  }

  return (
    <aside style={{
      width: 210, flexShrink: 0,
      background: "#0e1812",
      display: "flex", flexDirection: "column", height: "100vh",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="5" width="5" height="9" rx="1.5" fill="white" opacity="0.85"/>
              <rect x="9" y="1" width="5" height="13" rx="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>BrightTrack</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>BrightChamps</div>
          </div>
        </div>
      </div>

      {/* Portal switcher — segmented control */}
      <div style={{ padding: "10px 10px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{
          display: "flex", gap: 2, padding: 3, borderRadius: 9,
          background: "rgba(255,255,255,0.05)",
        }}>
          {portals.map((p) => (
            <button key={p} onClick={() => setPortal(p)} style={{
              flex: 1, padding: "5px 2px", fontSize: 11, fontWeight: 500,
              borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: "var(--font-body)", transition: "all 0.15s",
              background: portal === p ? "#fff" : "transparent",
              color: portal === p ? "#0e1812" : "rgba(255,255,255,0.4)",
            }}>
              {portalLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {NAV[portal].map((item) => {
          const active = activePage === item.id;
          return (
            <button key={item.id} onClick={() => emitPage(item.id)} style={{
              width: "100%", textAlign: "left", padding: "8px 12px",
              fontSize: 13, borderRadius: 8, border: "none", cursor: "pointer",
              marginBottom: 1, fontFamily: "var(--font-body)", transition: "all 0.1s",
              background: active ? "rgba(29,158,117,0.16)" : "transparent",
              color: active ? "#5DCAA5" : "rgba(255,255,255,0.45)",
              fontWeight: active ? 500 : 400,
            }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: "12px 14px", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600,
            background: isAdmin ? "rgba(29,158,117,0.2)" : color.bg,
            color: isAdmin ? "#5DCAA5" : color.text,
          }}>
            {isAdmin ? "AD" : initials(emp?.name || "?")}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {isAdmin ? "Admin" : emp?.name.split(" ")[0] || currentEmail.split("@")[0]}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {isAdmin ? "Administrator" : emp?.role || "Teacher"}
            </div>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 999,
            background: "rgba(29,158,117,0.18)", color: "#5DCAA5", flexShrink: 0, textTransform: "capitalize",
          }}>
            {portal}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "6px 10px", fontSize: 11, fontWeight: 500,
            borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
            cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.1s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
