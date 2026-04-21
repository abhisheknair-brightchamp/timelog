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
  const { portal, isAuthenticated, setAuth, currentEmployeeId, loadFromSheets } = useStore((s) => ({
    portal: s.portal,
    isAuthenticated: s.isAuthenticated,
    setAuth: s.setAuth,
    currentEmployeeId: s.currentEmployeeId,
    loadFromSheets: s.loadFromSheets,
  }));
  const [loading, setLoading] = useState(true);

  async function fetchAndLoad() {
    try {
      const res = await fetch(`${API_URL}?action=getAll`, { redirect: "follow" });
      const data = await res.json();
      if (data.employees) loadFromSheets(data);
    } catch (e) {
      console.error("Failed to load from Sheets:", e);
    }
  }

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (session) {
        setAuth(session.email, session.role, session.employeeId);
        await fetchAndLoad();
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleAuthenticated(data: { email: string; role: string; employeeId?: string | null }) {
    saveSession(data);
    setAuth(data.email, data.role, data.employeeId);
    await fetchAndLoad();
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0e1812", color: "#fff", fontSize: 14 }}>
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
            {portal === "account"   && <AccountPortal />}
            {portal === "timesheet" && <TimesheetPortal />}
          </>
        )}
      </main>
      <Toast />
    </div>
  );
}


export default function Home() {
  const { portal, isAuthenticated, setAuth, currentEmployeeId } = useStore((s) => ({
    portal: s.portal,
    isAuthenticated: s.isAuthenticated,
    setAuth: s.setAuth,
    currentEmployeeId: s.currentEmployeeId,
  }));

  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setAuth(session.email, session.role, session.employeeId);
    }
    setLoading(false);
  }, [setAuth]);

  function handleAuthenticated(data: { email: string; role: string; employeeId?: string | null }) {
    saveSession(data);
    setAuth(data.email, data.role, data.employeeId);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0e1812", color: "#fff", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--c-bg)" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {portal === "admin" && <AdminPortal />}
        {portal === "account" && <AccountPortal />}
        {portal === "timesheet" && <TimesheetPortal />}
      </main>
      <Toast />
    </div>
  );
}
