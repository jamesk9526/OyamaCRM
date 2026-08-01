/**
 * Steward Copilot standalone layout.
 * Bypasses the CRM AppShell so the workspace fills the full viewport edge-to-edge
 * and supports PWA installation on mobile devices.
 */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/** PWA + mobile metadata for the Steward Copilot route. */
export const metadata: Metadata = {
  title: "Steward Copilot — OyamaCRM v1.3",
  description: "Copilot-style CRM assistant for grounded donor intelligence and safe next actions.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Steward AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

/** Full-viewport standalone shell — no CRM chrome, no padding. */
export default function StewardWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-white">
      {children}
    </div>
  );
}

