"use client";
// src/components/ui/index.tsx
import React from "react";
import { initials, empColor } from "@/lib/utils";

// ─── Page Shell ──────────────────────────────────────────────────────────────
export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 22px",
          borderBottom: "0.5px solid var(--c-border)",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || "var(--c-text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
export function Avatar({ name, index, size = "sm" }: { name: string; index: number; size?: "sm" | "md" | "lg" }) {
  const c = empColor(index);
  const sizes = { sm: { wh: 24, fs: 9 }, md: { wh: 32, fs: 11 }, lg: { wh: 40, fs: 14 } };
  const s = sizes[size];
  return (
    <div
      style={{
        width: s.wh, height: s.wh, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: c.bg, color: c.text, fontSize: s.fs, fontWeight: 500,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────
type ChipVariant = "green" | "blue" | "amber" | "red" | "purple" | "gray";
const chipStyles: Record<ChipVariant, { bg: string; color: string; border?: string }> = {
  green:  { bg: "#E1F5EE", color: "#0F6E56" },
  blue:   { bg: "#E6F1FB", color: "#185FA5" },
  amber:  { bg: "#FAEEDA", color: "#854F0B" },
  red:    { bg: "#FCEBEB", color: "#A32D2D" },
  purple: { bg: "#EEEDFE", color: "#3C3489" },
  gray:   { bg: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid #D3D1C7" },
};

export function Chip({ label, variant = "gray", tiny }: { label: string; variant?: ChipVariant; tiny?: boolean }) {
  const s = chipStyles[variant];
  return (
    <span
      style={{
        display: "inline-block", fontSize: tiny ? 9 : 11, fontWeight: 500,
        padding: tiny ? "1px 6px" : "2px 8px", borderRadius: 999,
        background: s.bg, color: s.color,
        border: s.border || "none", whiteSpace: "nowrap", lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  );
}

// ─── Day Status Chip ─────────────────────────────────────────────────────────
import type { DayStatus } from "@/types";
const dayVariants: Record<DayStatus, ChipVariant> = {
  logged: "green", missing: "red", weekoff: "gray",
  holiday: "amber", upcoming: "blue", future: "gray", leave: "blue",
  "in-progress": "purple",
};
const dayLabels: Record<DayStatus, string> = {
  logged: "Submitted", missing: "Missing", weekoff: "Week off",
  holiday: "Holiday", upcoming: "Today", future: "—", leave: "On leave",
  "in-progress": "Clocked in",
};
export function DayChip({ status }: { status: DayStatus }) {
  return <Chip label={dayLabels[status]} variant={dayVariants[status]} />;
}

// ─── Tag Toggle ──────────────────────────────────────────────────────────────
export function TagPill({
  label, selected, type = "role", onClick,
}: {
  label: string; selected: boolean; type?: "role" | "vert"; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", padding: "4px 12px",
        borderRadius: 999, fontSize: 12, fontWeight: 500,
        border: selected
          ? (type === "role" ? "0.5px solid #9FE1CB" : "0.5px solid #AFA9EC")
          : "0.5px solid var(--c-border-strong)",
        background: selected
          ? (type === "role" ? "#E1F5EE" : "#EEEDFE")
          : "var(--c-bg)",
        color: selected
          ? (type === "role" ? "#0F6E56" : "#3C3489")
          : "var(--c-text-2)",
        cursor: "pointer", fontFamily: "var(--font-body)",
        transition: "all 0.1s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Section Label ───────────────────────────────────────────────────────────
export function SectionLabel({ children, mt }: { children: React.ReactNode; mt?: number }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: "var(--c-text-3)", textTransform: "uppercase",
      letterSpacing: "0.07em", marginBottom: 8, marginTop: mt ?? 20,
    }}>
      {children}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      background: "#fff",
      border: `0.5px solid ${highlight ? "var(--c-brand)" : "var(--c-border)"}`,
      borderRadius: "var(--r-lg)", padding: 16, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ─── Info Banner ─────────────────────────────────────────────────────────────
export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--c-bg)", borderLeft: "2px solid var(--c-brand)",
      borderRadius: "var(--r-sm)", padding: "9px 12px",
      fontSize: 12, color: "var(--c-text-2)", marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, variant = "default", size = "md", disabled,
}: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  size?: "md" | "sm" | "xs"; disabled?: boolean;
}) {
  const varStyles = {
    default: { background: "#fff", color: "var(--c-text)", border: "0.5px solid var(--c-border-strong)" },
    primary: { background: "var(--c-brand)", color: "#fff", border: "0.5px solid var(--c-brand)" },
    danger:  { background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid #F09595" },
  };
  const sizeStyles = {
    md: { padding: "7px 14px", fontSize: 13 },
    sm: { padding: "4px 10px", fontSize: 12 },
    xs: { padding: "3px 8px", fontSize: 11 },
  };
  const vs = varStyles[variant];
  const ss = sizeStyles[size];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        ...vs, ...ss, fontWeight: 500, fontFamily: "var(--font-body)",
        borderRadius: "var(--r-sm)", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "opacity 0.12s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let _toastTimeout: ReturnType<typeof setTimeout>;
export function showToast(msg: string) {
  const el = document.getElementById("tl-toast");
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => {
    if (el) { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; }
  }, 2600);
}

export function Toast() {
  return (
    <div
      id="tl-toast"
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        background: "#1a1a18", color: "#fff", fontSize: 13,
        padding: "9px 16px", borderRadius: "var(--r-md)",
        opacity: 0, transform: "translateY(8px)",
        transition: "opacity 0.2s, transform 0.2s",
        pointerEvents: "none",
      }}
    />
  );
}
