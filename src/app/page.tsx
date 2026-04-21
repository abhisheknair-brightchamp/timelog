"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getSession, saveSession, clearSession } from "@/lib/auth";
import LoginPage from "@/components/auth/LoginPage";
import Sidebar from "@/components/ui/Sidebar";
import AdminPortal from "@/components/admin/AdminPortal";
import AccountPortal from "@/components/account/AccountPortal";
import TimesheetPortal from "@/components/timesheet/TimesheetPortal";
import { Toast } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_SHEETS_URL || "";

export default function Home() {
  const { portal, isAuthenticated, setAuth, currentEmployeeId, loadFromSheets } = useStore((s: any) => ({
    portal: s.portal,
    isAuthenticated: s.isAuthenticated,
    setAuth: s.setAuth,
    currentEmployeeId: s.currentEmployeeId,
    loadFromSheets: s.loadFromSheets,
  }));
  const [loading, setLoading] = useState(true);

  async function fetchAndLoad() {
    if (!API_URL) return; // Sheets not configured — run on localStorage only
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s max
      const res = await fetch(API_URL + "?action=getAll", { redirect: "follow", signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.employees) loadFromSheets(data);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Sheets sync failed:", e);
      // App continues with cached localStorage data
    }
  }

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (session) {
        setAuth(session.email, session.role, session.employeeId);
        // Employees are cached in localStorage (partialize) so the app renders
        // instantly. We still await Sheets for fresh timesheets/queries.
        await fetchAndLoad();
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleAuthenticated(data: { email: string; role: string; employeeId?: string | null }) {
    saveSession(data);
    setAuth(data.email, data.role, data.employeeId);
    await fetchAndLoad(); // sync fresh data before entering the app
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#16104D", color: "#fff", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage onAuthenticated={handleAuthenticated} />;

  const isAdmin = currentEmployeeId === "admin";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--c-bg)" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {isAdmin ? (
          <AdminPortal />
        ) : (
          <>
            {portal === "account" && <AccountPortal />}
            {portal === "timesheet" && <TimesheetPortal />}
          </>
        )}
      </main>
      <Toast />
    </div>
  );
}
