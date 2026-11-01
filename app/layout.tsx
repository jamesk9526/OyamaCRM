import BridgeConnectionResume from "./components/ai/BridgeConnectionResume";
import SpreadsheetTables from "./components/ui/crm/spreadsheet/SpreadsheetTables";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./design-system.css";
import "./components/layout/reference-shell.css";
import "./module-design-adapters.css";
import { AuthProvider } from "./components/auth/AuthProvider";
import AppShell from "./components/layout/AppShell";
import { PluginProvider } from "./components/plugins/PluginProvider";
import PWARegister from "./components/pwa/PWARegister";

export const metadata: Metadata = {
  title: "OyamaCRM v2.0",
  description: "Nonprofit Donor Management",
  applicationName: "OyamaCRM v2.0",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OyamaCRM v2.0",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  icons: {
    apple: [
      { url: "/branding/oyama-crm-v2-icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/branding/oyama-crm-v2-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    notranslate: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
      notranslate: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f6cbd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">
        <PWARegister />
        <AuthProvider>
          <BridgeConnectionResume />
          <PluginProvider>
            <AppShell>{children}</AppShell>
            <SpreadsheetTables />
          </PluginProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
