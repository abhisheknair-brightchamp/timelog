/**
 * TimeLog — Google Apps Script Backend
 * ─────────────────────────────────────────────────────────────────────────────
 * Deploy as: Extensions → Apps Script → Deploy → New deployment
 *   Type: Web app
 *   Execute as: Me
 *   Access: Anyone
 *
 * SHEET SETUP — create one sheet per tab below, or run setupSheets() once.
 *
 * Tabs:
 *   Employees  | Timesheets | TimesheetEntries | AuditLog | Config | Holidays
 */

// ─── Sheet names ──────────────────────────────────────────────────────────────
const SHEETS = {
  EMPLOYEES:        "Employees",
  TIMESHEETS:       "Timesheets",
  TIMESHEET_ENTRIES:"TimesheetEntries",
  AUDIT:            "AuditLog",
  CONFIG:           "Config",
  HOLIDAYS:         "Holidays",
};

// ─── One-time setup ───────────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const defs = {
    [SHEETS.EMPLOYEES]: [
      "id","name","email","role","verticals","timezone",
      "weekoffs","minHoursPerDay","active","createdAt_UTC","createdAt_IST"
    ],
    [SHEETS.TIMESHEETS]: [
      "id","employeeId","employeeName","date","totalHours",
      "submitted","submittedAt_UTC","submittedAt_IST","submittedFromTz","entryCount"
    ],
    [SHEETS.TIMESHEET_ENTRIES]: [
      "timesheetId","employeeId","date","vertical","note","hours"
    ],
    [SHEETS.AUDIT]: [
      "id","timestamp_UTC","timestamp_IST","type",
      "actorId","actorName","subject","action","diffJSON"
    ],
    [SHEETS.CONFIG]: ["key","value","updatedAt_IST"],
    [SHEETS.HOLIDAYS]: ["id","date","name","addedAt_IST"],
  };

  Object.entries(defs).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#1D9E75")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  });

  Logger.log("Sheets created successfully");
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function istNow() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss 'IST'");
}
function toIST(utcMs) {
  if (!utcMs) return "";
  return Utilities.formatDate(new Date(utcMs), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss 'IST'");
}
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function uid() {
  return Utilities.getUuid().slice(0, 8);
}

// ─── CORS-friendly doOptions ──────────────────────────────────────────────────
function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

// ─── Router ───────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, data } = payload;

    const handlers = {
      submitTimesheet:  handleSubmitTimesheet,
      addAudit:         handleAddAudit,
      addEmployee:      handleAddEmployee,
      updateEmployee:   handleUpdateEmployee,
      addHoliday:       handleAddHoliday,
      removeHoliday:    handleRemoveHoliday,
      updateConfig:     handleUpdateConfig,
      addRole:          handleAddRole,
      removeRole:       handleRemoveRole,
      addVertical:      handleAddVertical,
      removeVertical:   handleRemoveVertical,
    };

    if (!handlers[action]) return jsonResponse({ ok: false, error: "Unknown action: " + action });
    const result = handlers[action](data);
    return jsonResponse({ ok: true, result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || "getAll";
    if (action === "getAll") return jsonResponse(getAllData());
    if (action === "getTimesheets") return jsonResponse(getTimesheets(e.parameter.employeeId));
    if (action === "getAudit") return jsonResponse(getAuditLog(e.parameter.limit));
    return jsonResponse({ ok: false, error: "Unknown GET action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleSubmitTimesheet(ts) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const entrySheet = getSheet(SHEETS.TIMESHEET_ENTRIES);
  const tsId = ts.id || uid();

  // Upsert timesheet row
  const rows = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === ts.employeeId && rows[i][2] === ts.date) {
      rowIdx = i + 1; break;
    }
  }

  const tsRow = [
    tsId,
    ts.employeeId,
    ts.employeeName || "",
    ts.date,
    ts.totalHours,
    ts.submitted ? "TRUE" : "FALSE",
    ts.submittedAt || Date.now(),
    toIST(ts.submittedAt || Date.now()),
    ts.submittedFromTz || "",
    (ts.entries || []).length,
  ];

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, tsRow.length).setValues([tsRow]);
  } else {
    sheet.appendRow(tsRow);
  }

  // Write individual entries
  (ts.entries || []).forEach((en) => {
    entrySheet.appendRow([
      tsId, ts.employeeId, ts.date,
      en.vertical, en.note || "", en.hours,
    ]);
  });

  return { timesheetId: tsId };
}

function handleAddAudit(entry) {
  const sheet = getSheet(SHEETS.AUDIT);
  sheet.appendRow([
    entry.id || uid(),
    entry.timestamp || Date.now(),
    toIST(entry.timestamp || Date.now()),
    entry.type,
    entry.actorId,
    entry.actorName,
    entry.subject,
    entry.action,
    JSON.stringify(entry.diff || null),
  ]);
  return { ok: true };
}

function handleAddEmployee(emp) {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const now = Date.now();
  sheet.appendRow([
    emp.id || uid(),
    emp.name,
    emp.email,
    emp.role,
    (emp.verticals || []).join(", "),
    emp.timezone || "Asia/Kolkata",
    (emp.weekoffs || []).join(","),
    emp.minHoursPerDay || 8,
    emp.active !== false ? "TRUE" : "FALSE",
    now,
    toIST(now),
  ]);
  return { ok: true };
}

function handleUpdateEmployee(data) {
  // data = { id, patch }
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const p = data.patch;
      if (p.name     !== undefined) sheet.getRange(i+1, 2).setValue(p.name);
      if (p.email    !== undefined) sheet.getRange(i+1, 3).setValue(p.email);
      if (p.role     !== undefined) sheet.getRange(i+1, 4).setValue(p.role);
      if (p.verticals!== undefined) sheet.getRange(i+1, 5).setValue(p.verticals.join(", "));
      if (p.timezone !== undefined) sheet.getRange(i+1, 6).setValue(p.timezone);
      if (p.weekoffs !== undefined) sheet.getRange(i+1, 7).setValue(p.weekoffs.join(","));
      if (p.minHoursPerDay !== undefined) sheet.getRange(i+1, 8).setValue(p.minHoursPerDay);
      return { ok: true };
    }
  }
  return { ok: false, error: "Employee not found" };
}

function handleAddHoliday(h) {
  const sheet = getSheet(SHEETS.HOLIDAYS);
  sheet.appendRow([h.id || uid(), h.date, h.name, istNow()]);
  return { ok: true };
}

function handleRemoveHoliday(data) {
  const sheet = getSheet(SHEETS.HOLIDAYS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) { sheet.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: false, error: "Holiday not found" };
}

function handleUpdateConfig(data) {
  // data = { key, value }
  const sheet = getSheet(SHEETS.CONFIG);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.key) {
      sheet.getRange(i+1, 2).setValue(data.value);
      sheet.getRange(i+1, 3).setValue(istNow());
      return { ok: true };
    }
  }
  sheet.appendRow([data.key, data.value, istNow()]);
  return { ok: true };
}

function handleAddRole(data) {
  return upsertConfigList("roles", data.role, "add");
}
function handleRemoveRole(data) {
  return upsertConfigList("roles", data.role, "remove");
}
function handleAddVertical(data) {
  return upsertConfigList("verticals", data.vertical, "add");
}
function handleRemoveVertical(data) {
  return upsertConfigList("verticals", data.vertical, "remove");
}

function upsertConfigList(key, value, op) {
  const sheet = getSheet(SHEETS.CONFIG);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      const current = rows[i][1] ? rows[i][1].split(",").map(s => s.trim()).filter(Boolean) : [];
      const updated = op === "add"
        ? [...new Set([...current, value])]
        : current.filter(x => x !== value);
      sheet.getRange(i+1, 2).setValue(updated.join(", "));
      sheet.getRange(i+1, 3).setValue(istNow());
      return { ok: true, updated };
    }
  }
  // First time — create row
  sheet.appendRow([key, value, istNow()]);
  return { ok: true };
}

// ─── GET helpers ──────────────────────────────────────────────────────────────

function getAllData() {
  return {
    employees: sheetToObjects(SHEETS.EMPLOYEES),
    timesheets: sheetToObjects(SHEETS.TIMESHEETS),
    timesheetEntries: sheetToObjects(SHEETS.TIMESHEET_ENTRIES),
    holidays: sheetToObjects(SHEETS.HOLIDAYS),
    config: sheetToObjects(SHEETS.CONFIG),
    auditLog: sheetToObjects(SHEETS.AUDIT),
  };
}

function getTimesheets(employeeId) {
  const all = sheetToObjects(SHEETS.TIMESHEETS);
  const entries = sheetToObjects(SHEETS.TIMESHEET_ENTRIES);
  return all
    .filter(t => !employeeId || t.employeeId === employeeId)
    .map(t => ({
      ...t,
      entries: entries.filter(e => e.timesheetId === t.id),
    }));
}

function getAuditLog(limit) {
  const rows = sheetToObjects(SHEETS.AUDIT);
  rows.reverse(); // newest first
  return limit ? rows.slice(0, parseInt(limit)) : rows;
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}
