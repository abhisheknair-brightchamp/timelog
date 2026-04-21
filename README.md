# TimeLog — Employee Timesheet System

Full-stack time tracking app: Next.js 14 frontend + Google Apps Script backend.
Deploy the frontend free on Vercel. Zero backend cost — Google Sheets is your database.

---

## Architecture

```
Browser (Next.js on Vercel)
  └── Zustand store (persisted to localStorage)
        └── On every write → POST to Apps Script Web App
                                └── Writes to Google Sheets tabs
```

All state lives in the browser first (instant UX), then syncs to Sheets in the background.

---

## 1. Google Sheets setup (5 min)

1. Create a new Google Sheet at sheets.google.com
2. Open **Extensions → Apps Script**
3. Delete the default `myFunction` code
4. Paste the entire contents of `apps-script/Code.gs`
5. Run `setupSheets()` once — it creates all 6 tabs with headers:
   - Employees
   - Timesheets
   - TimesheetEntries
   - AuditLog
   - Config
   - Holidays
6. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the Web App URL (looks like `https://script.google.com/macros/s/ABC123.../exec`)

---

## 2. Local development

```bash
git clone <your-repo>
cd timelog
npm install
cp .env.example .env.local
# Edit .env.local and paste your Apps Script URL
npm run dev
```

Open http://localhost:3000

---

## 3. Deploy to Vercel (2 min)

1. Push to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Add environment variable:
   - Key: `NEXT_PUBLIC_SHEETS_URL`
   - Value: your Apps Script Web App URL
4. Deploy — you'll get a URL like `timelog.yourcompany.vercel.app`

---

## Portals

### Admin portal
| Page | What you can do |
|---|---|
| Dashboard | Live team status — who's submitted, pending, on leave |
| Team view | Employees grouped by vertical |
| Employees | Onboard, edit roles/verticals/timezone/weekoffs/min hours |
| Roles & verticals | Add/remove roles and verticals dynamically |
| Public holidays | Org-wide holidays (auto-excluded from timesheets) |
| Settings | Paste Google Sheets URL |
| Audit log | Every change with actor, timestamp (IST), and field-level diffs |

### My account portal
| Page | What you can do |
|---|---|
| Profile & timezone | Set name, email, timezone (once — auto-applied everywhere) |
| Week off days | View your schedule + upcoming holidays |

### Timesheet portal
| Page | What you can do |
|---|---|
| Log hours | Submit daily timesheet — vertical + note + hours per entry |
| My history | Calendar view + full entry log |

---

## Google Sheets schema

### Employees
`id | name | email | role | verticals | timezone | weekoffs | minHoursPerDay | active | createdAt_UTC | createdAt_IST`

### Timesheets
`id | employeeId | employeeName | date | totalHours | submitted | submittedAt_UTC | submittedAt_IST | submittedFromTz | entryCount`

### TimesheetEntries
`timesheetId | employeeId | date | vertical | note | hours`

### AuditLog
`id | timestamp_UTC | timestamp_IST | type | actorId | actorName | subject | action | diffJSON`

### Config
`key | value | updatedAt_IST`

### Holidays
`id | date | name | addedAt_IST`

---

## Timezone handling

- All UTC timestamps stored as raw milliseconds — the single source of truth
- Admin dashboard always shows IST
- Employees set timezone once in Account → Profile
- Hours calculated as pure UTC diff — DST-safe, half-hour offset safe (IST, NPT, etc.)
- Google Sheet stores both UTC and IST columns for audit readability

---

## Customisation

**Add a new role:** Admin → Roles & verticals → Add role
**Add a new vertical:** Admin → Roles & verticals → Add vertical
**Change an employee's week offs:** Admin → Employees → Edit
**Add a public holiday:** Admin → Public holidays → Add

Everything is reflected immediately with a full audit trail.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Free on Vercel, great DX |
| State | Zustand + persist | Zero-config, localStorage sync |
| Styling | CSS variables + utility classes | No build complexity |
| Backend | Google Apps Script | Free, no server, Sheets as DB |
| Fonts | DM Sans + DM Mono | Clean, professional |
