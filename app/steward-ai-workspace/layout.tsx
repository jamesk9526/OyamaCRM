/** Steward Copilot metadata. The route itself now renders inside the CRM AppShell. */
import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Route metadata for the embedded Steward Copilot workspace. */
export const metadata: Metadata = {
  title: "Steward — OyamaCRM v2",
  description: "Chathead CRM assistant for grounded donor intelligence and safe next actions.",
};

/** Keep route-local metadata without introducing a second application shell. */
export default function StewardWorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}

