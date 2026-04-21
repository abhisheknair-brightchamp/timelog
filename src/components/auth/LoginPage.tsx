"use client";
import { useState, useRef } from "react";
import { sendOTP, verifyOTP, createPassword, login, checkUserExists } from "@/lib/auth";
import { showToast, Toast } from "@/components/ui";

type Step = "email" | "otp" | "create-password" | "login-password";

export default function LoginPage({ onAuthenticated }: { onAuthenticated: (data: any) => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
        console.log("sendOTP:", JSON.stringify(res));
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
      console.log("verifyOTP:", JSON.stringify(res));
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
      console.log("createPassword:", JSON.stringify(res));
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
      console.log("login:", JSON.stringify(res));
      if (res.ok && res.result?.authenticated) onAuthenticated({ email: res.result.email, role: res.result.role, employeeId: res.result.employeeId });
      else showToast(res.result?.error || "Login failed");
    } catch (err: any) { showToast("Network error"); }
    finally { setLoading(false); submitting.current = false; }
  }

  const btnStyle = (disabled: boolean) => ({
    width: "100%", padding: "10px 16px", fontSize: 13, fontWeight: 500,
    borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#ccc" : "#1D9E75", color: "#fff",
    fontFamily: "inherit", marginBottom: 12,
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1812", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: "40px 36px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="6" width="6" height="12" rx="2" fill="white" opacity="0.85"/>
              <rect x="12" y="2" width="6" height="16" rx="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a18" }}>BrightTrack</div>
            <div style={{ fontSize: 11, color: "#9b9b96", marginTop: 2 }}>Teacher Timesheets</div>
          </div>
        </div>

        {step === "email" && <>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20, textAlign: "center" }}>Sign in to your account</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()} placeholder="your.email@brightchamps.com" style={{ marginBottom: 16 }} autoFocus />
          <button onClick={handleEmailSubmit} disabled={loading} style={btnStyle(loading)}>{loading ? "Checking..." : "Continue →"}</button>
        </>}

        {step === "otp" && <>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Verify your email</div>
          <div style={{ fontSize: 12, color: "#5c5c58", marginBottom: 20 }}>6-digit code sent to <strong>{email}</strong></div>
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handleOTPVerify()} placeholder="000000" maxLength={6} autoFocus style={{ marginBottom: 16, fontSize: 24, letterSpacing: "0.2em", textAlign: "center", fontFamily: "monospace" }} />
          <button onClick={handleOTPVerify} disabled={loading || otp.length !== 6} style={btnStyle(loading || otp.length !== 6)}>{loading ? "Verifying..." : "Verify Code"}</button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <button onClick={() => { setStep("email"); setOtp(""); }} style={{ color: "#5c5c58", background: "none", border: "none", cursor: "pointer" }}>Back</button>
            <button onClick={async () => { setOtp(""); submitting.current = false; const res = await sendOTP(email); if (res.ok) showToast("New OTP sent!"); }} style={{ color: "#1D9E75", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Resend OTP</button>
          </div>
        </>}

        {step === "create-password" && <>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Create your password</div>
          <div style={{ fontSize: 12, color: "#5c5c58", marginBottom: 20 }}>Minimum 8 characters</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreatePassword()} placeholder="••••••••" style={{ marginBottom: 16 }} autoFocus />
          <button onClick={handleCreatePassword} disabled={loading || password.length < 8} style={btnStyle(loading || password.length < 8)}>{loading ? "Creating..." : "Create Account"}</button>
        </>}

        {step === "login-password" && <>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Welcome back</div>
          <div style={{ fontSize: 12, color: "#5c5c58", marginBottom: 20 }}>Password for <strong>{email}</strong></div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={{ marginBottom: 16 }} autoFocus />
          <button onClick={handleLogin} disabled={loading} style={btnStyle(loading)}>{loading ? "Signing in..." : "Sign In"}</button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <button onClick={() => { setStep("email"); setPassword(""); }} style={{ color: "#5c5c58", background: "none", border: "none", cursor: "pointer" }}>Different email</button>
            <button onClick={async () => { setStep("otp"); setPassword(""); setOtp(""); submitting.current = false; await sendOTP(email); showToast("OTP sent!"); }} style={{ color: "#1D9E75", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Forgot password?</button>
          </div>
        </>}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "0.5px solid #e8e7e3", fontSize: 11, color: "#9b9b96", textAlign: "center" }}>
          BrightChamps Teacher Timesheet System
        </div>
      </div>
      <Toast />
    </div>
  );
}
