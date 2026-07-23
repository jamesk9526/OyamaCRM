import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/auth/AuthProvider";
import AppShell from "./components/layout/AppShell";
import { PluginProvider } from "./components/plugins/PluginProvider";
import PWARegister from "./components/pwa/PWARegister";

const crmSans = Manrope({
  subsets: ["latin"],
  variable: "--font-crm-sans",
  display: "swap",
});

const crmHeading = Sora({
  subsets: ["latin"],
  variable: "--font-crm-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OyamaCRM v1.3",
  description: "Nonprofit Donor Management",
  applicationName: "OyamaCRM v1.3",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OyamaCRM v1.3",
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
      { url: "/api/pwa/icon?size=180", sizes: "180x180", type: "image/png" },
      { url: "/api/pwa/icon?size=192", sizes: "192x192", type: "image/png" },
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
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${crmSans.variable} ${crmHeading.variable}`}>
      <body className="h-full">
        <PWARegister />
        <AuthProvider>
          <PluginProvider>
            <AppShell>{children}</AppShell>
          </PluginProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
