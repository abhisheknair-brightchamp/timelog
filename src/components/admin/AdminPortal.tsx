"use client";
// src/components/admin/AdminPortal.tsx
import { useState, useEffect } from "react";
import { Toast } from "@/components/ui";
import Dashboard from "./Dashboard";
import TeamView from "./TeamView";
import Employees from "./Employees";
import RolesVerticals from "./RolesVerticals";
import HolidaysPage from "./HolidaysPage";
import AuditLog from "./AuditLog";
import SettingsPage from "./SettingsPage";
import Analytics from "./Analytics";
import LogsPage from "./LogsPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  analytics: Analytics,
  logs: LogsPage,
  team: TeamView,
  employees: Employees,
  roles: RolesVerticals,
  holidays: HolidaysPage,
  auditlog: AuditLog,
  settings: SettingsPage,
};

export default function AdminPortal() {
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const handler = (e: Event) => setPage((e as CustomEvent).detail);
    window.addEventListener("tl:page", handler);
    return () => window.removeEventListener("tl:page", handler);
  }, []);

  const Page = PAGE_MAP[page] || Dashboard;
  return (
    <>
      <Page />
      <Toast />
    </>
  );
}
