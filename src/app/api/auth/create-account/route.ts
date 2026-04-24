// Server-side only — admin creates an employee account with a temp password
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, tempPassword, employeeId } = await req.json();
    if (!email || !tempPassword || !employeeId) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Check if user already exists in auth
    const { data: existing } = await admin
      .from("user_profiles")
      .select("id, has_password")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existing?.has_password) {
      return NextResponse.json({ ok: false, error: "Employee already has an account" });
    }

    let userId: string;

    if (existing) {
      // User profile exists but no password — update password via admin
      const { data: authUser } = await admin.auth.admin.getUserById(existing.id);
      if (authUser.user) {
        await admin.auth.admin.updateUserById(existing.id, { password: tempPassword });
        userId = existing.id;
      } else {
        return NextResponse.json({ ok: false, error: "Auth user not found" });
      }
    } else {
      // Try to create new auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
      });

      if (createErr) {
        // If user already exists in auth.users (but no profile), look them up by email
        const { data: listData } = await admin.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingAuthUser) {
          // Update their password and reuse their ID
          await admin.auth.admin.updateUserById(existingAuthUser.id, { password: tempPassword });
          userId = existingAuthUser.id;
        } else {
          return NextResponse.json({ ok: false, error: createErr.message || "Failed to create user" });
        }
      } else if (!created.user) {
        return NextResponse.json({ ok: false, error: "Failed to create user" });
      } else {
        userId = created.user.id;
      }
    }

    // Upsert user_profiles with is_temp_password = true
    const { error: profileErr } = await admin
      .from("user_profiles")
      .upsert({
        id: userId,
        email: email.toLowerCase(),
        role: "employee",
        employee_id: employeeId,
        has_password: true,
        is_temp_password: true,
      });

    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("create-account error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
