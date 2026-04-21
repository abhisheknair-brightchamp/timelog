"use client";
// src/app/page.tsx
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getSession, saveSession, clearSession } from "@/lib/auth";
import LoginPage from "@/components/auth/LoginPage";
import Sidebar from "@/components/ui/Sidebar";
import AdminPortal from "@/components/admin/AdminPortal";
import AccountPortal from "@/components/account/AccountPortal";
import TimesheetPortal from "@/components/timesheet/TimesheetPortal";
import { Toast } from "@/components/ui";

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
