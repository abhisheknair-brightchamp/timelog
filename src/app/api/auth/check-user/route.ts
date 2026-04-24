// Server-side only — uses service_role key to bypass RLS
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
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ exists: false });

  const admin = getAdminClient();

  // Check if they already have a profile with a password set
  const { data: profile } = await admin
    .from("user_profiles")
    .select("has_password, role, employee_id")
    .eq("email", email)
    .maybeSingle();

  if (profile?.has_password) {
    return NextResponse.json({
      exists: true,
      role: profile.role,
      employeeId: profile.employee_id,
    });
  }

  // Check if they're a registered employee (required to create account)
  const isAdmin = email === ADMIN_EMAIL.toLowerCase();
  if (!isAdmin) {
    const { data: emp } = await admin
      .from("employees")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return NextResponse.json({ exists: false, isEmployee: !!emp });
  }

  return NextResponse.json({ exists: false, isEmployee: true });
}
