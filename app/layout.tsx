import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/auth/AuthProvider";
import AppShell from "./components/layout/AppShell";
import { PluginProvider } from "./components/plugins/PluginProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OyamaCRM",
  description: "Nonprofit Donor Management",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full">
        <AuthProvider>
          <PluginProvider>
            <AppShell>{children}</AppShell>
          </PluginProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
