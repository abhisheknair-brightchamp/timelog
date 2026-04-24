"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getSession, saveSession, clearSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchAllData } from "@/lib/db";
import LoginPage from "@/components/auth/LoginPage";
import Sidebar from "@/components/ui/Sidebar";
import AdminPortal from "@/components/admin/AdminPortal";
import AccountPortal from "@/components/account/AccountPortal";
import TimesheetPortal from "@/components/timesheet/TimesheetPortal";
import { Toast } from "@/components/ui";

export default function Home() {
  const { portal, isAuthenticated, setAuth, currentEmployeeId, loadFromSupabase } = useStore(
    (s: any) => ({
      portal: s.portal,
      isAuthenticated: s.isAuthenticated,
      setAuth: s.setAuth,
      currentEmployeeId: s.currentEmployeeId,
      loadFromSupabase: s.loadFromSupabase,
    })
  );
  const [loading, setLoading] = useState(true);

  async function syncData() {
    try {
      const data = await fetchAllData();
      loadFromSupabase(data);
    } catch (e) {
      console.error("Supabase sync failed:", e);
      // App continues with cached localStorage data
    }
  }

  useEffect(() => {
    async function init() {
      // 1. Check for an active Supabase session (handles token refresh)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Fetch the user's profile for role + employeeId
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role, employee_id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          const role = profile.role || "employee";
          const employeeId = role === "admin" ? null : profile.employee_id;
          setAuth(session.user.email!, role, employeeId);
          saveSession({ email: session.user.email!, role, employeeId });
          await syncData();
        } else {
          // Profile missing — fall back to localStorage session
          const cached = getSession();
          if (cached) {
            setAuth(cached.email, cached.role, cached.employeeId);
            await syncData();
          }
        }
      } else {
        // No Supabase session — check localStorage fallback
        const cached = getSession();
        if (cached) {
          // Stale session: clear it and force re-login
          clearSession();
        }
      }

      setLoading(false);
    }

    init();

    // Listen for Supabase auth state changes (e.g. token refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        clearSession();
        useStore.getState().logout();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthenticated(data: {
    email: string;
    role: string;
    employeeId?: string | null;
  }) {
    saveSession(data);
    setAuth(data.email, data.role, data.employeeId);
    await syncData();
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#16104D",
          color: "#fff",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage onAuthenticated={handleAuthenticated} />;

  const isAdmin = currentEmployeeId === "admin";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--c-bg)",
      }}
    >
      <Sidebar />
      <main
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
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
