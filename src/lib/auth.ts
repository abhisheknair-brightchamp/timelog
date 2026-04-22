const API_URL = process.env.NEXT_PUBLIC_SHEETS_URL || "";

async function appsScriptPost(action: string, data: any) {
  const res = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  return res.json();
}

export async function sendOTP(email: string) {
  return appsScriptPost("sendOTP", { email });
}
export async function verifyOTP(email: string, otp: string) {
  return appsScriptPost("verifyOTP", { email, otp });
}
export async function createPassword(email: string, password: string) {
  return appsScriptPost("createPassword", { email, password });
}
export async function login(email: string, password: string) {
  return appsScriptPost("login", { email, password });
}
export async function checkUserExists(email: string) {
  const res = await fetch(`${API_URL}?action=checkUser&email=${encodeURIComponent(email)}`, { redirect: "follow" });
  return res.json();
}
export async function resetPassword(email: string) {
  return appsScriptPost("resetPassword", { email });
}
export function saveSession(data: { email: string; role: string; employeeId?: string | null }) {
  localStorage.setItem("bt_session", JSON.stringify(data));
}
export function getSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("bt_session");
  return raw ? JSON.parse(raw) : null;
}
export function clearSession() {
  localStorage.removeItem("bt_session");
}
