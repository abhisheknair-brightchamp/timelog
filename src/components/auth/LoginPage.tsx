"use client";
import { useState, useRef } from "react";
import { sendOTP, verifyOTP, createPassword, login, checkUserExists } from "@/lib/auth";
import { showToast, Toast } from "@/components/ui";

type Step = "email" | "otp" | "create-password" | "login-password" | "change-password";

const BRAND = "#6B5CE7";
const BRAND_DARK = "#5548CC";

export default function LoginPage({ onAuthenticated }: { onAuthenticated: (data: any) => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [pendingAuth, setPendingAuth] = useState<any>(null);
  const submitting = useRef(false);

  async function handleEmailSubmit() {
    if (submitting.current) return;
    if (!email.includes("@")) { showToast("Enter a valid email"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const checkRes = await checkUserExists(email);
      if (checkRes.exists) {
        setStep("login-password");
      } else {
        const res = await sendOTP(email);
        if (res.ok && res.result?.sent) { showToast("OTP sent!"); setStep("otp"); }
        else showToast(res.result?.error || "Failed to send OTP");
      }
    } catch (err: any) { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  async function handleOTPVerify() {
    if (submitting.current) return;
    if (otp.length !== 6) { showToast("Enter 6-digit code"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await verifyOTP(email, otp);
      if (res.ok && res.result?.valid) { showToast("Verified!"); setStep("create-password"); }
      else showToast(res.result?.error || "Invalid OTP");
    } catch (err: any) { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  async function handleCreatePassword() {
    if (submitting.current) return;
    if (password.length < 8) { showToast("Min 8 characters"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await createPassword(email, password);
      if (res.ok && res.result?.created) onAuthenticated({ email, role: res.result.role, employeeId: null });
      else showToast(res.result?.error || "Failed");
    } catch (err: any) { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  async function handleLogin() {
    if (submitting.current) return;
    if (!password) { showToast("Enter your password"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.ok && res.result?.authenticated) {
        const authData = { email: res.result.email, role: res.result.role, employeeId: res.result.employeeId };
        // Check if temp password — force change before entering app
        if (res.result.isTempPassword) {
          setUserId(res.result.userId || "");
          setPendingAuth(authData);
          setNewPassword("");
          setConfirmPassword("");
          setStep("change-password");
        } else {
          onAuthenticated(authData);
        }
      } else {
        showToast(res.result?.error || "Login failed");
      }
    } catch (err: any) { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  async function handleChangePassword() {
    if (submitting.current) return;
    if (newPassword.length < 8) { showToast("Min 8 characters"); return; }
    if (newPassword !== confirmPassword) { showToast("Passwords don't match"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Password updated!");
        onAuthenticated(pendingAuth);
      } else {
        showToast(data.error || "Failed to update password");
      }
    } catch { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: "100%", padding: "11px 16px", fontSize: 14, fontWeight: 700,
    borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#C4BFEE" : BRAND, color: "#fff",
    fontFamily: "inherit", marginBottom: 12,
    boxShadow: disabled ? "none" : `0 4px 14px rgba(107,92,231,0.35)`,
    transition: "opacity 0.15s",
  });

  const linkBtn = (color = "#52506e"): React.CSSProperties => ({
    color, background: "none", border: "none", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  });

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
      background: "linear-gradient(135deg, #1A1264 0%, #2D2080 50%, #16104D 100%)",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "fixed", top: -80, right: -80, width: 340, height: 340, borderRadius: "50%", background: "rgba(107,92,231,0.15)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -60, left: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(245,184,0,0.08)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: "40px 36px", boxShadow: "0 20px 60px rgba(22,16,77,0.35)", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
          <img src="/BrightCHAMPS-Profile-Logo.jpg" alt="BrightChamps" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1830", letterSpacing: "-0.02em" }}>
              Bright<span style={{ color: BRAND }}>Track</span>
            </div>
            <div style={{ fontSize: 11, color: "#9b99b2", marginTop: 1, fontWeight: 500 }}>Teacher Timesheets</div>
          </div>
        </div>

        {step === "email" && <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: "center", color: "#1a1830" }}>Sign in to your account</div>
          <div style={{ fontSize: 12, color: "#9b99b2", marginBottom: 22, textAlign: "center" }}>Enter your BrightChamps email to continue</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()} placeholder="your.email@brightchamps.com" style={{ marginBottom: 14 }} autoFocus />
          <button onClick={handleEmailSubmit} disabled={loading} style={btnStyle(loading)}>{loading ? "Checking…" : "Continue →"}</button>
        </>}

        {step === "otp" && <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#1a1830" }}>Verify your email</div>
          <div style={{ fontSize: 12, color: "#52506e", marginBottom: 22 }}>6-digit code sent to <strong>{email}</strong></div>
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handleOTPVerify()} placeholder="000000" maxLength={6} autoFocus style={{ marginBottom: 14, fontSize: 24, letterSpacing: "0.3em", textAlign: "center", fontFamily: "monospace" }} />
          <button onClick={handleOTPVerify} disabled={loading || otp.length !== 6} style={btnStyle(loading || otp.length !== 6)}>{loading ? "Verifying…" : "Verify Code"}</button>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => { setStep("email"); setOtp(""); }} style={linkBtn()}>← Back</button>
            <button onClick={async () => { setOtp(""); submitting.current = false; const res = await sendOTP(email); if (res.ok) showToast("New OTP sent!"); }} style={linkBtn(BRAND)}>Resend OTP</button>
          </div>
        </>}

        {step === "create-password" && <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#1a1830" }}>Create your password</div>
          <div style={{ fontSize: 12, color: "#52506e", marginBottom: 22 }}>Minimum 8 characters</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreatePassword()} placeholder="••••••••" style={{ marginBottom: 14 }} autoFocus />
          <button onClick={handleCreatePassword} disabled={loading || password.length < 8} style={btnStyle(loading || password.length < 8)}>{loading ? "Creating…" : "Create Account"}</button>
        </>}

        {step === "login-password" && <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#1a1830" }}>Welcome back 👋</div>
          <div style={{ fontSize: 12, color: "#52506e", marginBottom: 22 }}>Password for <strong>{email}</strong></div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={{ marginBottom: 14 }} autoFocus />
          <button onClick={handleLogin} disabled={loading} style={btnStyle(loading)}>{loading ? "Signing in…" : "Sign In →"}</button>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => { setStep("email"); setPassword(""); }} style={linkBtn()}>Different email</button>
            <button onClick={async () => { setStep("otp"); setPassword(""); setOtp(""); submitting.current = false; await sendOTP(email); showToast("OTP sent!"); }} style={linkBtn(BRAND)}>Forgot password?</button>
          </div>
        </>}

        {step === "change-password" && <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#1a1830" }}>Set your password</div>
          <div style={{ fontSize: 12, color: "#52506e", marginBottom: 22 }}>
            You're using a temporary password. Please set a permanent one to continue.
          </div>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            style={{ marginBottom: 10 }}
            autoFocus
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            placeholder="Confirm new password"
            style={{ marginBottom: 14 }}
          />
          <button
            onClick={handleChangePassword}
            disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
            style={btnStyle(loading || newPassword.length < 8 || newPassword !== confirmPassword)}
          >
            {loading ? "Saving…" : "Set Password & Continue →"}
          </button>
        </>}

        <div style={{ marginTop: 32, paddingTop: 18, borderTop: `0.5px solid #EEEDFE`, fontSize: 11, color: "#9b99b2", textAlign: "center" }}>
          BrightChamps Teacher Timesheet System
        </div>
      </div>
      <Toast />
    </div>
  );
}
