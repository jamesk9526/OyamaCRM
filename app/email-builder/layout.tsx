/**
 * Email Builder Layout
 *
 * Standalone layout for the email builder route segment.
 * Renders children full-viewport without any nav chrome.
 * The root layout's AppShell bypasses itself for /email-builder routes.
 * NOTE: <html>/<body> must NOT appear here — only in the root layout.tsx.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Builder — OyamaCRM v1.3",
};

/** Full-screen wrapper — no AppShell chrome. */
export default function EmailBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-hidden">{children}</div>
  );
}
