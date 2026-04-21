"use client";
// src/app/page.tsx
import { useStore } from "@/lib/store";
import Sidebar from "@/components/ui/Sidebar";
import AdminPortal from "@/components/admin/AdminPortal";
import AccountPortal from "@/components/account/AccountPortal";
import TimesheetPortal from "@/components/timesheet/TimesheetPortal";

export default function Home() {
  const portal = useStore((s) => s.portal);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--c-bg)" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {portal === "admin" && <AdminPortal />}
        {portal === "account" && <AccountPortal />}
        {portal === "timesheet" && <TimesheetPortal />}
      </main>
    </div>
  );
}
