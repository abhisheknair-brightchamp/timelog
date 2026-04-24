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
    { id: "logs",       label: "All logs"          },
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
  const portals: Portal[] = isAdmin ? ["admin", "account", "timesheet"] : ["account", "timesheet"];
  const portalLabels: Record<Portal, string> = { admin: "Admin", account: "Account", timesheet: "Sheet" };

  async function handleLogout() {
    logout();
    if (typeof window !== "undefined") {
      const { clearSession } = require("@/lib/auth");
      try {
        await clearSession();
      } catch (e) {
        console.error("Logout error:", e);
      }
      // Redirect instead of reload for cleaner logout
      window.location.href = "/";
    }
  }

  const { notifications } = useStore((s) => ({ notifications: s.notifications }));
  const unreadCount = notifications.filter((n) => n.employeeId === currentEmployeeId && !n.read).length;

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "#16104D",
      display: "flex", flexDirection: "column", height: "100vh",
    }}>
      {/* BrightChamps Logo */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/BrightCHAMPS-Profile-Logo.jpg" alt="BrightChamps" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              Bright<span style={{ color: "#F5B800" }}>Track</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>BrightChamps</div>
          </div>
        </div>
      </div>

      {/* Portal switcher */}
      <div style={{ padding: "10px 10px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div style={{
          display: "flex", gap: 2, padding: 3, borderRadius: 10,
          background: "rgba(255,255,255,0.05)",
        }}>
          {portals.map((p) => (
            <button key={p} onClick={() => setPortal(p)} style={{
              flex: 1, padding: "5px 2px", fontSize: 11, fontWeight: 600,
              borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "var(--font-body)", transition: "all 0.15s",
              background: portal === p ? "#fff" : "transparent",
              color: portal === p ? "#16104D" : "rgba(255,255,255,0.4)",
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
              fontSize: 13, borderRadius: 9, border: "none", cursor: "pointer",
              marginBottom: 2, fontFamily: "var(--font-body)", transition: "all 0.1s",
              background: active ? "rgba(107,92,231,0.22)" : "transparent",
              color: active ? "#B5B0F5" : "rgba(255,255,255,0.45)",
              fontWeight: active ? 600 : 400,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {item.label}
              {item.id === "history" && unreadCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                  background: "#F5B800", color: "#16104D",
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: "12px 14px", borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700,
            background: isAdmin ? "rgba(107,92,231,0.3)" : color.bg,
            color: isAdmin ? "#B5B0F5" : color.text,
          }}>
            {isAdmin ? "AD" : initials(emp?.name || "?")}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {isAdmin ? "Admin" : emp?.name.split(" ")[0] || currentEmail.split("@")[0]}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {isAdmin ? "Administrator" : emp?.role || "Teacher"}
            </div>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
            background: "rgba(107,92,231,0.3)", color: "#B5B0F5", flexShrink: 0, textTransform: "capitalize",
          }}>
            {portal}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "7px 10px", fontSize: 11, fontWeight: 600,
            borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.1)",
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
