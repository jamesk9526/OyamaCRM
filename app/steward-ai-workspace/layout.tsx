/**
 * AGENTSteward workspace standalone layout.
 * Bypasses the CRM AppShell so the workspace fills the full viewport edge-to-edge
 * and supports PWA installation on mobile devices.
 */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/** PWA + mobile metadata for the Steward workspace route. */
export const metadata: Metadata = {
  title: "AGENTSteward — OyamaCRM",
  description: "AI-powered CRM assistant for donor intelligence and fundraising.",
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

