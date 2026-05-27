/**
 * Root layout for the standalone Oyama Letters Next.js app.
 *
 * The Letters workspace is intentionally minimal — there is no sidebar, top
 * bar, or auth provider here. Letters reuses the main OyamaCRM session
 * cookies via the `/api/*` proxy (see next.config.ts) and renders a single
 * focused production studio surface.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oyama Letters",
  description: "Standalone document production studio for the OyamaCRM family of apps.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
