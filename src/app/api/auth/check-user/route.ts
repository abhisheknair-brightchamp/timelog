// Server-side only — uses service_role key to bypass RLS
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
    if (!email) return NextResponse.json({ exists: false });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("Missing Supabase env vars:", { url: !!url, key: !!key });
      return NextResponse.json(
        { error: "Server misconfiguration: missing Supabase credentials" },
        { status: 500 }
      );
    }

    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if they already have a profile with a password set
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id, has_password, role, employee_id, is_temp_password")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile query error:", profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (profile?.has_password) {
      return NextResponse.json({
        exists: true,
        role: profile.role,
        employeeId: profile.employee_id,
        isTempPassword: profile.is_temp_password === true,
        userId: profile.id,
      });
    }

    // Check if they're a registered employee (required to create account)
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      const { data: emp, error: empError } = await admin
        .from("employees")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (empError) {
        console.error("Employee query error:", empError);
        return NextResponse.json(
          { error: empError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ exists: false, isEmployee: !!emp });
    }

    return NextResponse.json({ exists: false, isEmployee: true });
  } catch (error) {
    console.error("Check user error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
