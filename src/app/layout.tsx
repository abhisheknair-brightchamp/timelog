// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrightTrack — BrightChamps Teacher Timesheets",
  description: "Track teacher hours, roles, verticals and payouts for BrightChamps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
