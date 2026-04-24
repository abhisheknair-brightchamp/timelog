// src/lib/auth.ts — Supabase Auth layer
import { supabase } from "./supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

/* ------------------------------------------------------------------ */
/*  CHECK USER EXISTS (calls server-side API to bypass RLS)           */
/* ------------------------------------------------------------------ */

export async function checkUserExists(email: string) {
  try {
    const res = await fetch(`/api/auth/check-user?email=${encodeURIComponent(email)}`);
    return await res.json();
  } catch {
    return { exists: false };
  }
}

/* ------------------------------------------------------------------ */
/*  OTP — send 6-digit code via Supabase Auth                         */
/* ------------------------------------------------------------------ */

export async function sendOTP(email: string) {
  // Check if the email is a registered employee first
  const check = await checkUserExists(email);
  if (!check.exists && !check.isEmployee && email !== ADMIN_EMAIL) {
    return { ok: false, result: { error: "This email is not registered in the system. Contact your admin." } };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, result: { error: error.message } };
  return { ok: true, result: { sent: true } };
}

/* ------------------------------------------------------------------ */
/*  VERIFY OTP                                                         */
/* ------------------------------------------------------------------ */

export async function verifyOTP(email: string, otp: string) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });
  if (error) return { ok: false, result: { error: error.message } };
  return { ok: true, result: { valid: true } };
}

/* ------------------------------------------------------------------ */
/*  CREATE PASSWORD (called after OTP verified — session is active)   */
/* ------------------------------------------------------------------ */

export async function createPassword(email: string, password: string) {
  // Update the authenticated user's password
  const { error: pwErr } = await supabase.auth.updateUser({ password });
  if (pwErr) return { ok: false, result: { error: pwErr.message } };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, result: { error: "Session lost — please try again." } };

  // Determine role and employee_id
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const role = isAdmin ? "admin" : "employee";

  // Find employee record
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // Upsert user profile
  await supabase.from("user_profiles").upsert({
    id: user.id,
    email,
    role,
    employee_id: isAdmin ? null : (emp?.id ?? null),
    has_password: true,
  });

  return {
    ok: true,
    result: {
      created: true,
      role,
      employeeId: isAdmin ? null : (emp?.id ?? null),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  LOGIN with password                                                */
/* ------------------------------------------------------------------ */

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, result: { error: error?.message || "Login failed" } };
  }

  // Fetch profile for role + employeeId + temp password flag
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, employee_id, is_temp_password")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = profile?.role || "employee";
  const employeeId = profile?.employee_id ?? null;
  const isTempPassword = profile?.is_temp_password === true;

  return {
    ok: true,
    result: {
      authenticated: true,
      email: data.user.email,
      role,
      employeeId,
      isTempPassword,
      userId: data.user.id,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  FORGOT PASSWORD — resend OTP to reset                             */
/* ------------------------------------------------------------------ */

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return { ok: false, result: { error: error.message } };
  return { ok: true, result: { sent: true } };
}

/* ------------------------------------------------------------------ */
/*  SESSION — keep a lightweight localStorage copy for instant hydrate */
/* ------------------------------------------------------------------ */

export function saveSession(data: { email: string; role: string; employeeId?: string | null }) {
  localStorage.setItem("bt_session", JSON.stringify(data));
}

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("bt_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("bt_session");
    return null;
  }
}

export async function clearSession() {
  localStorage.removeItem("bt_session");
  await supabase.auth.signOut();
}
