export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const SHEETS_URL = process.env.NEXT_PUBLIC_SHEETS_URL || "";

export async function POST(req: NextRequest) {
  if (!SHEETS_URL) {
    return NextResponse.json({ ok: false, error: "Sheets URL not configured" }, { status: 500 });
  }
  try {
    const body = await req.text();
    const res = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
    });
    const text = await res.text();
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ ok: false, error: text }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
