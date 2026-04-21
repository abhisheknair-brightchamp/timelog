/**
 * BrightTrack — Google Apps Script Backend with Email OTP Auth
 * ─────────────────────────────────────────────────────────────────────────────
 * Deploy: Extensions → Apps Script → Deploy → New deployment
 *   Type: Web app | Execute as: Me | Access: Anyone
 *
 * Sheets: Employees | Timesheets | TimesheetEntries | AuditLog | Config | 
 *         Holidays | Users | Sessions | Leaves
 */

const SHEETS = {
  EMPLOYEES:        "Employees",
  TIMESHEETS:       "Timesheets",
  TIMESHEET_ENTRIES:"TimesheetEntries",
  AUDIT:            "AuditLog",
  CONFIG:           "Config",
  HOLIDAYS:         "Holidays",
  USERS:            "Users",
  SESSIONS:         "Sessions",
  LEAVES:           "Leaves",
  QUERIES:          "Queries",
};

const ADMIN_EMAIL = "abhishek.nair@brightchamps.com";

// ─── Setup (run once) ─────────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defs = {
    [SHEETS.EMPLOYEES]: ["id","name","email","role","verticals","timezone","weekoffs","minHoursPerDay","active","createdAt_UTC","createdAt_IST"],
    [SHEETS.TIMESHEETS]: ["id","employeeId","employeeName","date","totalHours","submitted","submittedAt_UTC","submittedAt_IST","submittedFromTz","entryCount","startedAt_UTC","endedAt_UTC","status","capturedHours","rejectedAt_UTC","rejectedBy","rejectedByName","rejectionReason"],
    [SHEETS.TIMESHEET_ENTRIES]: ["timesheetId","employeeId","date","vertical","note","hours"],
    [SHEETS.AUDIT]: ["id","timestamp_UTC","timestamp_IST","type","actorId","actorName","subject","action","diffJSON"],
    [SHEETS.CONFIG]: ["key","value","updatedAt_IST"],
    [SHEETS.HOLIDAYS]: ["id","date","name","addedAt_IST"],
    [SHEETS.USERS]: ["email","passwordHash","role","createdAt_UTC","createdAt_IST"],
    [SHEETS.SESSIONS]: ["email","otp","expiresAt_UTC","createdAt_UTC"],
    [SHEETS.LEAVES]: ["id","employeeId","date","type","note","appliedAt_UTC","appliedAt_IST"],
    [SHEETS.QUERIES]: ["id","timesheetId","employeeId","byActorId","byActorName","question","response","status","createdAt_UTC","createdAt_IST","respondedAt_UTC","resolvedAt_UTC","messagesJSON"],
  };
  Object.entries(defs).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1D9E75").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  });
  Logger.log("✓ Sheets created");
}

// ─── Migration: run once to add new columns to existing sheets ────────────────
function migrateSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Add messagesJSON column to Queries sheet if missing
  const qSheet = ss.getSheetByName(SHEETS.QUERIES);
  if (qSheet) {
    const headers = qSheet.getRange(1, 1, 1, qSheet.getLastColumn()).getValues()[0];
    if (!headers.includes("messagesJSON")) {
      const newCol = qSheet.getLastColumn() + 1;
      qSheet.getRange(1, newCol).setValue("messagesJSON");
      qSheet.getRange(1, newCol).setFontWeight("bold").setBackground("#4B3DE3").setFontColor("#ffffff");
      Logger.log("✓ Added messagesJSON column to Queries sheet at col " + newCol);
    } else {
      Logger.log("✓ messagesJSON column already exists");
    }
  }
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function uid() {
  return Utilities.getUuid().slice(0, 8);
}
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + "BrightTrack_Salt_2026"));
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

// ─── Router ───────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, data } = payload;
    const handlers = {
      // Auth
      sendOTP:          handleSendOTP,
      verifyOTP:        handleVerifyOTP,
      createPassword:   handleCreatePassword,
      login:            handleLogin,
      resetPassword:    handleResetPassword,
      // Timesheets
      submitTimesheet:  handleSubmitTimesheet,
      addAudit:         handleAddAudit,
      // Employees
      addEmployee:      handleAddEmployee,
      updateEmployee:   handleUpdateEmployee,
      // Holidays
      addHoliday:       handleAddHoliday,
      removeHoliday:    handleRemoveHoliday,
      // Config
      updateConfig:     handleUpdateConfig,
      addRole:          handleAddRole,
      removeRole:       handleRemoveRole,
      addVertical:      handleAddVertical,
      removeVertical:   handleRemoveVertical,
      // Leaves
      applyLeave:       handleApplyLeave,
      cancelLeave:      handleCancelLeave,
      // Queries
      createQuery:      handleCreateQuery,
      respondQuery:     handleRespondQuery,
      resolveQuery:     handleResolveQuery,
      // Shift moderation
      rejectTimesheet:  handleRejectTimesheet,
      reverseRejection: handleReverseRejection,
      resetShift:       handleResetShift,
      resetCheckin:     handleResetCheckin,
      resetCheckout:    handleResetCheckout,
      // Query messages
      addQueryMessage:  handleAddQueryMessage,
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
    if (action === "checkUser") return jsonResponse(checkUser(e.parameter.email));
    return jsonResponse({ ok: false, error: "Unknown GET action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ─── AUTH HANDLERS ────────────────────────────────────────────────────────────

function handleSendOTP(data) {
  const { email } = data;
  if (!email || !email.includes("@")) return { error: "Invalid email" };
  
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
  
  // Clear old sessions for this email
  const sessSheet = getSheet(SHEETS.SESSIONS);
  const rows = sessSheet.getDataRange().getValues();
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i][0] === email) sessSheet.deleteRow(i + 1);
  }
  
  // Store new OTP
  sessSheet.appendRow([email, otp, expiresAt, Date.now()]);
  
  // Send email
  try {
    MailApp.sendEmail({
      to: email,
      subject: "BrightTrack Login — Your OTP Code",
      body: `Your BrightTrack verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, please ignore this email.`,
    });
    return { sent: true };
  } catch (e) {
    return { error: "Failed to send email: " + e };
  }
}

function handleVerifyOTP(data) {
  const { email, otp } = data;
  const sessSheet = getSheet(SHEETS.SESSIONS);
  const rows = sessSheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === email && rows[i][1] === otp) {
      const expiresAt = rows[i][2];
      if (Date.now() > expiresAt) {
        sessSheet.deleteRow(i + 1);
        return { valid: false, error: "OTP expired" };
      }
      sessSheet.deleteRow(i + 1); // OTP consumed
      return { valid: true };
    }
  }
  return { valid: false, error: "Invalid OTP" };
}

function handleCreatePassword(data) {
  const { email, password } = data;
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };
  
  const usersSheet = getSheet(SHEETS.USERS);
  const empSheet = getSheet(SHEETS.EMPLOYEES);
  
  // Check if user already exists
  const userRows = usersSheet.getDataRange().getValues();
  for (let i = 1; i < userRows.length; i++) {
    if (userRows[i][0] === email) return { error: "User already exists. Please login." };
  }
  
  // Determine role
  let role = "employee";
  if (email === ADMIN_EMAIL) {
    role = "admin";
  } else {
    // Must exist in Employees sheet
    const empRows = empSheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < empRows.length; i++) {
      if (empRows[i][2] === email) { found = true; break; }
    }
    if (!found) return { error: "Email not found in employee records. Contact admin." };
  }
  
  const now = Date.now();
  usersSheet.appendRow([email, hashPassword(password), role, now, toIST(now)]);
  
  return { created: true, role };
}

function handleLogin(data) {
  const { email, password } = data;
  const usersSheet = getSheet(SHEETS.USERS);
  const rows = usersSheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === email) {
      const storedHash = rows[i][1];
      const inputHash = hashPassword(password);
      if (storedHash === inputHash) {
        const role = rows[i][2];
        
        // Get employee data if not admin
        let employeeId = null;
        if (role === "employee") {
          const empSheet = getSheet(SHEETS.EMPLOYEES);
          const empRows = empSheet.getDataRange().getValues();
          for (let j = 1; j < empRows.length; j++) {
            if (empRows[j][2] === email) {
              employeeId = empRows[j][0];
              break;
            }
          }
        }
        
        return { authenticated: true, role, email, employeeId };
      }
      return { authenticated: false, error: "Incorrect password" };
    }
  }
  return { authenticated: false, error: "User not found" };
}

function handleResetPassword(data) {
  const { email } = data;
  
  // Delete user record so they can re-create password
  const usersSheet = getSheet(SHEETS.USERS);
  const rows = usersSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === email) {
      usersSheet.deleteRow(i + 1);
      break;
    }
  }
  
  // Send OTP
  return handleSendOTP({ email });
}

// ─── EXISTING HANDLERS (unchanged) ────────────────────────────────────────────

function handleSubmitTimesheet(ts) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const entrySheet = getSheet(SHEETS.TIMESHEET_ENTRIES);
  const tsId = ts.id || uid();
  const rows = sheet.getDataRange().getValues();
  // Upsert by shift id (multiple shifts per employee/day now allowed)
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === tsId) { rowIdx = i + 1; break; }
  }
  const tsRow = [
    tsId, ts.employeeId, ts.employeeName || "", ts.date, ts.totalHours || 0,
    ts.submitted ? "TRUE" : "FALSE",
    ts.submittedAt || "", toIST(ts.submittedAt || 0),
    ts.submittedFromTz || "", (ts.entries || []).length,
    ts.startedAt || "", ts.endedAt || "", ts.status || (ts.submitted ? "submitted" : "in-progress"),
    (typeof ts.capturedHours === "number") ? ts.capturedHours : "",
    ts.rejectedAt || "", ts.rejectedBy || "", ts.rejectedByName || "", ts.rejectionReason || "",
  ];
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, tsRow.length).setValues([tsRow]);
    // Remove prior entries for this ts and re-append fresh
    const erows = entrySheet.getDataRange().getValues();
    for (let i = erows.length - 1; i > 0; i--) {
      if (erows[i][0] === tsId) entrySheet.deleteRow(i + 1);
    }
  } else {
    sheet.appendRow(tsRow);
  }
  (ts.entries || []).forEach((en) => {
    entrySheet.appendRow([tsId, ts.employeeId, ts.date, en.vertical, en.note || "", en.hours]);
  });
  return { timesheetId: tsId };
}

function handleRejectTimesheet(data) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 13).setValue("rejected"); // status col
      sheet.getRange(i + 1, 15).setValue(data.rejectedAt || Date.now()); // rejectedAt_UTC
      sheet.getRange(i + 1, 16).setValue(data.rejectedBy || "");
      sheet.getRange(i + 1, 17).setValue(data.rejectedByName || "");
      sheet.getRange(i + 1, 18).setValue(data.reason || "");
      return { ok: true };
    }
  }
  return { ok: false, error: "Shift not found" };
}

function handleReverseRejection(data) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 13).setValue("submitted");
      sheet.getRange(i + 1, 15).setValue("");
      sheet.getRange(i + 1, 16).setValue("");
      sheet.getRange(i + 1, 17).setValue("");
      sheet.getRange(i + 1, 18).setValue("");
      return { ok: true };
    }
  }
  return { ok: false, error: "Shift not found" };
}

function handleResetShift(data) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const entrySheet = getSheet(SHEETS.TIMESHEET_ENTRIES);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i][0] === data.id) {
      sheet.deleteRow(i + 1);
      // Remove entries too
      const erows = entrySheet.getDataRange().getValues();
      for (let j = erows.length - 1; j > 0; j--) {
        if (erows[j][0] === data.id) entrySheet.deleteRow(j + 1);
      }
      return { ok: true };
    }
  }
  return { ok: false, error: "Shift not found" };
}

function handleAddAudit(entry) {
  const sheet = getSheet(SHEETS.AUDIT);
  sheet.appendRow([entry.id || uid(), entry.timestamp || Date.now(), toIST(entry.timestamp || Date.now()), entry.type, entry.actorId, entry.actorName, entry.subject, entry.action, JSON.stringify(entry.diff || null)]);
  return { ok: true };
}

function handleAddEmployee(emp) {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const now = Date.now();
  sheet.appendRow([emp.id || uid(), emp.name, emp.email, emp.role, (emp.verticals || []).join(", "), emp.timezone || "Asia/Kolkata", (emp.weekoffs || []).join(","), emp.minHoursPerDay || 8, emp.active !== false ? "TRUE" : "FALSE", now, toIST(now)]);
  return { ok: true };
}

function handleUpdateEmployee(data) {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      const p = data.patch;
      if (p.name !== undefined) sheet.getRange(i+1, 2).setValue(p.name);
      if (p.email !== undefined) sheet.getRange(i+1, 3).setValue(p.email);
      if (p.role !== undefined) sheet.getRange(i+1, 4).setValue(p.role);
      if (p.verticals !== undefined) sheet.getRange(i+1, 5).setValue(p.verticals.join(", "));
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

function handleAddRole(data) { return upsertConfigList("roles", data.role, "add"); }
function handleRemoveRole(data) { return upsertConfigList("roles", data.role, "remove"); }
function handleAddVertical(data) { return upsertConfigList("verticals", data.vertical, "add"); }
function handleRemoveVertical(data) { return upsertConfigList("verticals", data.vertical, "remove"); }

function upsertConfigList(key, value, op) {
  const sheet = getSheet(SHEETS.CONFIG);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      const current = rows[i][1] ? rows[i][1].split(",").map(s => s.trim()).filter(Boolean) : [];
      const updated = op === "add" ? [...new Set([...current, value])] : current.filter(x => x !== value);
      sheet.getRange(i+1, 2).setValue(updated.join(", "));
      sheet.getRange(i+1, 3).setValue(istNow());
      return { ok: true, updated };
    }
  }
  sheet.appendRow([key, value, istNow()]);
  return { ok: true };
}

function handleApplyLeave(data) {
  const sheet = getSheet(SHEETS.LEAVES);
  const now = Date.now();
  sheet.appendRow([data.id || uid(), data.employeeId, data.date, data.type, data.note || "", now, toIST(now)]);
  return { ok: true };
}

function handleCancelLeave(data) {
  const sheet = getSheet(SHEETS.LEAVES);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) { sheet.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: false, error: "Leave not found" };
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

function handleCreateQuery(q) {
  const sheet = getSheet(SHEETS.QUERIES);
  if (!sheet) return { ok: false, error: "Queries sheet missing — re-run setupSheets()" };
  const now = q.createdAt || Date.now();
  const initialMessages = q.messages || [{ id: uid(), role: "admin", actorName: q.byActorName || "Admin", text: q.question, createdAt: now }];
  sheet.appendRow([
    q.id || uid(), q.timesheetId, q.employeeId,
    q.byActorId, q.byActorName || "",
    q.question, "", q.status || "open",
    now, toIST(now), "", "",
    JSON.stringify(initialMessages),
  ]);
  return { ok: true };
}

function handleAddQueryMessage(data) {
  // data = { id: queryId, msg: { id, role, actorName, text, createdAt } }
  const sheet = getSheet(SHEETS.QUERIES);
  if (!sheet) return { ok: false, error: "Queries sheet missing" };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      // Parse existing messages (col 13)
      let messages = [];
      try { messages = JSON.parse(rows[i][12] || "[]"); } catch(e) { messages = []; }
      // If messages was empty, seed with the original question
      if (!messages.length && rows[i][5]) {
        messages = [{ id: uid(), role: "admin", actorName: rows[i][4] || "Admin", text: rows[i][5], createdAt: rows[i][8] || Date.now() }];
      }
      messages.push(data.msg);
      sheet.getRange(i + 1, 13).setValue(JSON.stringify(messages));
      // If employee reply, also update response + respondedAt cols
      if (data.msg.role === "employee") {
        sheet.getRange(i + 1, 7).setValue(data.msg.text);
        sheet.getRange(i + 1, 11).setValue(data.msg.createdAt || Date.now());
      }
      return { ok: true };
    }
  }
  return { ok: false, error: "Query not found" };
}

function handleRespondQuery(data) {
  // Legacy — treated as employee message
  return handleAddQueryMessage({ id: data.id, msg: { id: uid(), role: "employee", actorName: "Employee", text: data.response, createdAt: data.respondedAt || Date.now() } });
}

function handleResolveQuery(data) {
  const sheet = getSheet(SHEETS.QUERIES);
  if (!sheet) return { ok: false, error: "Queries sheet missing" };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 8).setValue("resolved");
      sheet.getRange(i + 1, 12).setValue(data.resolvedAt || Date.now());
      return { ok: true };
    }
  }
  return { ok: false, error: "Query not found" };
}

function handleResetCheckin(data) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 5).setValue(0);          // totalHours
      sheet.getRange(i + 1, 6).setValue("FALSE");    // submitted
      sheet.getRange(i + 1, 7).setValue("");          // submittedAt_UTC
      sheet.getRange(i + 1, 11).setValue("");         // startedAt_UTC
      sheet.getRange(i + 1, 12).setValue("");         // endedAt_UTC
      sheet.getRange(i + 1, 13).setValue("in-progress"); // status
      sheet.getRange(i + 1, 14).setValue(0);          // capturedHours
      return { ok: true };
    }
  }
  return { ok: false, error: "Shift not found" };
}

function handleResetCheckout(data) {
  const sheet = getSheet(SHEETS.TIMESHEETS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 5).setValue(0);          // totalHours
      sheet.getRange(i + 1, 6).setValue("FALSE");    // submitted
      sheet.getRange(i + 1, 7).setValue("");          // submittedAt_UTC
      sheet.getRange(i + 1, 12).setValue("");         // endedAt_UTC
      sheet.getRange(i + 1, 13).setValue("in-progress"); // status
      sheet.getRange(i + 1, 14).setValue(0);          // capturedHours
      return { ok: true };
    }
  }
  return { ok: false, error: "Shift not found" };
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
    leaves: sheetToObjects(SHEETS.LEAVES),
    queries: sheetToObjects(SHEETS.QUERIES),
  };
}

function checkUser(email) {
  const usersSheet = getSheet(SHEETS.USERS);
  const rows = usersSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === email) {
      return { exists: true, role: rows[i][2] };
    }
  }
  return { exists: false };
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
