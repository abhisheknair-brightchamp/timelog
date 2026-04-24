// Server-side only — change temp password to permanent
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
    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const admin = getAdminClient();

    // Update password in Supabase Auth
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message });
    }

    // Mark is_temp_password = false
    const { error: profileErr } = await admin
      .from("user_profiles")
      .update({ is_temp_password: false })
      .eq("id", userId);

    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("change-password error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
