/**
 * One-time migration script: Google Sheets → Supabase
 *
 * Run ONCE after setting up the Supabase schema:
 *   npx ts-node --project tsconfig.json scripts/migrate.ts
 *
 * Requires these env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SHEETS_URL          (your Apps Script exec URL)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHEETS_URL = process.env.NEXT_PUBLIC_SHEETS_URL!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SHEETS_URL) {
  console.error("Missing env vars. Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SHEETS_URL");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchFromSheets() {
  console.log("Fetching data from Google Sheets...");
  const res = await fetch(SHEETS_URL + "?action=getAll", { redirect: "follow" });
  const data = await res.json();
  console.log(`Fetched: ${data.employees?.length ?? 0} employees, ${data.timesheets?.length ?? 0} timesheets`);
  return data;
}

async function migrateEmployees(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.id && r.email)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      email: String(r.email || ""),
      role: String(r.role || ""),
      verticals: r.verticals
        ? String(r.verticals).split(",").map((v: string) => v.trim()).filter(Boolean)
        : [],
      timezone: String(r.timezone || "Asia/Kolkata"),
      weekoffs: (r.weekoffs !== null && r.weekoffs !== undefined && r.weekoffs !== "")
        ? String(r.weekoffs).split(",").map(Number).filter((n: number) => !isNaN(n))
        : [],
      min_hours_per_day: Number(r.minHoursPerDay) || 8,
      active: r.active !== "FALSE",
      created_at: Number(r.createdAt_UTC) || Date.now(),
    }));

  const { error } = await supabase.from("employees").upsert(records);
  if (error) throw new Error(`Employees: ${error.message}`);
  console.log(`✓ Migrated ${records.length} employees`);
}

async function migrateHolidays(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.id && r.date)
    .map((r) => ({ id: String(r.id), date: String(r.date), name: String(r.name || "") }));

  const { error } = await supabase.from("holidays").upsert(records);
  if (error) throw new Error(`Holidays: ${error.message}`);
  console.log(`✓ Migrated ${records.length} holidays`);
}

async function migrateConfig(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.key)
    .map((r) => ({ key: String(r.key), value: String(r.value || "") }));

  const { error } = await supabase.from("config").upsert(records);
  if (error) throw new Error(`Config: ${error.message}`);
  console.log(`✓ Migrated ${records.length} config entries`);
}

async function migrateLeaves(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.id && r.employeeId)
    .map((r) => ({
      id: String(r.id),
      employee_id: String(r.employeeId),
      date: String(r.date).slice(0, 10),
      type: String(r.type || "other"),
      note: String(r.note || ""),
      applied_at: Number(r.appliedAt_UTC) || Date.now(),
    }));

  const { error } = await supabase.from("leaves").upsert(records);
  if (error) throw new Error(`Leaves: ${error.message}`);
  console.log(`✓ Migrated ${records.length} leaves`);
}

async function migrateTimesheets(tsRows: any[], entryRows: any[]) {
  if (!tsRows?.length) return;

  // Build entry map
  const entryMap: Record<string, any[]> = {};
  (entryRows || []).forEach((r: any) => {
    const id = String(r.timesheetId);
    if (!entryMap[id]) entryMap[id] = [];
    entryMap[id].push(r);
  });

  const timesheets = tsRows
    .filter((r) => r.id && r.employeeId)
    .map((r) => ({
      id: String(r.id),
      employee_id: String(r.employeeId),
      date: String(r.date).slice(0, 10),
      total_hours: Number(r.totalHours) || 0,
      captured_hours: r.capturedHours ? Number(r.capturedHours) : null,
      adjusted_hours: (r.adjustedHours !== "" && r.adjustedHours != null) ? Number(r.adjustedHours) : null,
      submitted: r.submitted === "TRUE" || r.submitted === true,
      submitted_at: r.submittedAt_UTC ? Number(r.submittedAt_UTC) : null,
      submitted_from_tz: String(r.submittedFromTz || "Asia/Kolkata"),
      started_at: r.startedAt_UTC ? Number(r.startedAt_UTC) : null,
      ended_at: r.endedAt_UTC ? Number(r.endedAt_UTC) : null,
      status: String(r.status || "submitted"),
      rejected_at: r.rejectedAt_UTC ? Number(r.rejectedAt_UTC) : null,
      rejected_by: r.rejectedBy ? String(r.rejectedBy) : null,
      rejected_by_name: r.rejectedByName ? String(r.rejectedByName) : null,
      rejection_reason: r.rejectionReason ? String(r.rejectionReason) : null,
    }));

  // Upsert in batches of 100
  for (let i = 0; i < timesheets.length; i += 100) {
    const batch = timesheets.slice(i, i + 100);
    const { error } = await supabase.from("timesheets").upsert(batch);
    if (error) throw new Error(`Timesheets batch ${i}: ${error.message}`);
  }

  // Migrate entries
  const allEntries: any[] = [];
  tsRows.forEach((r) => {
    const entries = entryMap[String(r.id)] || [];
    entries.forEach((e) => {
      allEntries.push({
        timesheet_id: String(r.id),
        vertical: String(e.vertical || ""),
        note: String(e.note || ""),
        hours: Number(e.hours) || 0,
      });
    });
  });

  if (allEntries.length) {
    for (let i = 0; i < allEntries.length; i += 100) {
      const batch = allEntries.slice(i, i + 100);
      const { error } = await supabase.from("timesheet_entries").insert(batch);
      if (error) throw new Error(`Entries batch ${i}: ${error.message}`);
    }
  }

  console.log(`✓ Migrated ${timesheets.length} timesheets, ${allEntries.length} entries`);
}

async function migrateQueries(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.id && r.timesheetId)
    .map((r) => {
      let messages = [];
      if (r.messagesJSON) {
        try { messages = JSON.parse(r.messagesJSON); } catch {}
      }
      if (!messages.length) {
        const q = String(r.question || "");
        messages = [{ id: r.id + "_q", role: "admin", actorName: String(r.byActorName || "Admin"), text: q, createdAt: Number(r.createdAt_UTC) || Date.now() }];
        if (r.response) {
          messages.push({ id: r.id + "_r", role: "employee", actorName: "Employee", text: String(r.response), createdAt: Number(r.respondedAt_UTC) || Date.now() });
        }
      }
      return {
        id: String(r.id),
        timesheet_id: String(r.timesheetId),
        employee_id: String(r.employeeId),
        by_actor_id: String(r.byActorId || ""),
        by_actor_name: String(r.byActorName || ""),
        question: String(r.question || ""),
        response: r.response ? String(r.response) : null,
        messages,
        status: r.status === "resolved" ? "resolved" : "open",
        created_at: Number(r.createdAt_UTC) || Date.now(),
        responded_at: r.respondedAt_UTC ? Number(r.respondedAt_UTC) : null,
        resolved_at: r.resolvedAt_UTC ? Number(r.resolvedAt_UTC) : null,
      };
    });

  const { error } = await supabase.from("queries").upsert(records);
  if (error) throw new Error(`Queries: ${error.message}`);
  console.log(`✓ Migrated ${records.length} queries`);
}

async function migrateAuditLog(rows: any[]) {
  if (!rows?.length) return;
  const records = rows
    .filter((r) => r.id)
    .map((r) => ({
      id: String(r.id),
      timestamp_utc: Number(r.timestamp_UTC) || Date.now(),
      type: String(r.type || "config"),
      actor_id: String(r.actorId || ""),
      actor_name: String(r.actorName || ""),
      subject: String(r.subject || ""),
      action: String(r.action || ""),
      diff: null,
    }));

  for (let i = 0; i < records.length; i += 100) {
    const { error } = await supabase.from("audit_log").upsert(records.slice(i, i + 100));
    if (error) throw new Error(`Audit batch ${i}: ${error.message}`);
  }
  console.log(`✓ Migrated ${records.length} audit entries`);
}

async function main() {
  console.log("=== BrightTrack: Sheets → Supabase Migration ===\n");

  const data = await fetchFromSheets();

  await migrateEmployees(data.employees);
  await migrateHolidays(data.holidays);
  await migrateConfig(data.config);
  await migrateLeaves(data.leaves);
  await migrateTimesheets(data.timesheets, data.timesheetEntries);
  await migrateQueries(data.queries);
  await migrateAuditLog(data.auditLog);

  console.log("\n=== Migration complete ===");
  console.log("NOTE: All employees must re-register via OTP (passwords cannot be migrated).");
  console.log("The admin must register first using the NEXT_PUBLIC_ADMIN_EMAIL address.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
