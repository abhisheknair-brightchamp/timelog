-- ============================================================
-- BrightTrack Supabase Schema
-- Run this in Supabase → SQL Editor
-- ============================================================

-- ---- EMPLOYEES ----
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT '',
  verticals TEXT[] DEFAULT '{}',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  weekoffs INTEGER[] DEFAULT '{}',
  min_hours_per_day NUMERIC NOT NULL DEFAULT 8,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ---- USER PROFILES (maps Supabase Auth users → employees) ----
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee', -- 'admin' | 'employee'
  employee_id TEXT REFERENCES employees(id),
  has_password BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---- TIMESHEETS ----
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  captured_hours NUMERIC,
  adjusted_hours NUMERIC,
  submitted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at BIGINT,
  submitted_from_tz TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  started_at BIGINT,
  ended_at BIGINT,
  status TEXT NOT NULL DEFAULT 'in-progress',
  rejected_at BIGINT,
  rejected_by TEXT,
  rejected_by_name TEXT,
  rejection_reason TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ---- TIMESHEET ENTRIES ----
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id BIGSERIAL PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  hours NUMERIC NOT NULL DEFAULT 0
);

-- ---- HOLIDAYS ----
CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT ''
);

-- ---- CONFIG (key-value) ----
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ---- LEAVES ----
CREATE TABLE IF NOT EXISTS leaves (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  note TEXT NOT NULL DEFAULT '',
  applied_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE(employee_id, date)
);

-- ---- QUERIES ----
CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  by_actor_id TEXT NOT NULL DEFAULT '',
  by_actor_name TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  response TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  responded_at BIGINT,
  resolved_at BIGINT
);

-- ---- NOTIFICATIONS ----
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'query',
  message TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  timesheet_date TEXT
);

-- ---- AUDIT LOG ----
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp_utc BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  type TEXT NOT NULL DEFAULT 'config',
  actor_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  diff JSONB
);

-- ============================================================
-- HELPER FUNCTION: check if current user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: get the employee_id of the current user
CREATE OR REPLACE FUNCTION my_employee_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT employee_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays          ENABLE ROW LEVEL SECURITY;
ALTER TABLE config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves            ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- employees: all authenticated can read; only admin can write
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (is_admin());

-- user_profiles: own row only for users; admin sees all; anon can check by email
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR is_admin());

-- timesheets: own or admin
CREATE POLICY "timesheets_select" ON timesheets FOR SELECT TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "timesheets_delete" ON timesheets FOR DELETE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());

-- timesheet_entries: via parent timesheet
CREATE POLICY "entries_select" ON timesheet_entries FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM timesheets t WHERE t.id = timesheet_id AND t.employee_id = my_employee_id()));
CREATE POLICY "entries_insert" ON timesheet_entries FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM timesheets t WHERE t.id = timesheet_id AND t.employee_id = my_employee_id()));
CREATE POLICY "entries_delete" ON timesheet_entries FOR DELETE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM timesheets t WHERE t.id = timesheet_id AND t.employee_id = my_employee_id()));

-- holidays: all authenticated can read; only admin can write
CREATE POLICY "holidays_select" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_insert" ON holidays FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "holidays_delete" ON holidays FOR DELETE TO authenticated USING (is_admin());

-- config: all authenticated can read; only admin can write
CREATE POLICY "config_select" ON config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_write" ON config FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- leaves: own or admin
CREATE POLICY "leaves_select" ON leaves FOR SELECT TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "leaves_insert" ON leaves FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "leaves_update" ON leaves FOR UPDATE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "leaves_delete" ON leaves FOR DELETE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());

-- queries: involved parties or admin
CREATE POLICY "queries_select" ON queries FOR SELECT TO authenticated
  USING (is_admin() OR employee_id = my_employee_id() OR by_actor_id = auth.uid()::TEXT);
CREATE POLICY "queries_insert" ON queries FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR employee_id = my_employee_id() OR by_actor_id = auth.uid()::TEXT);
CREATE POLICY "queries_update" ON queries FOR UPDATE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());

-- notifications: own employee_id or admin (admin gets 'admin' id)
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (is_admin() OR employee_id = my_employee_id());

-- audit_log: admin sees all; authenticated can insert
CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- DEFAULT CONFIG SEED
-- ============================================================
INSERT INTO config (key, value) VALUES
  ('roles', 'Admin,Instructor,Team Lead,Trainer'),
  ('verticals', 'Roblox,Coding,Maths,English,Chess')
ON CONFLICT (key) DO NOTHING;
