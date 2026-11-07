"use client";
import { Suspense } from "react";
import BridgeConnectionResume from "./ai/BridgeConnectionResume";
import SpreadsheetTables from "./ui/crm/spreadsheet/SpreadsheetTables";
import { AuthProvider } from "./auth/AuthProvider";
import AppShell from "./layout/AppShell";
import { PluginProvider } from "./plugins/PluginProvider";
import PWARegister from "./pwa/PWARegister";
import LegacyCreateRedirect from "./oyama-create/LegacyCreateRedirect";
export default function DefaultWorkspaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PWARegister />
      <AuthProvider>
        <Suspense fallback={null}><LegacyCreateRedirect /></Suspense>
        <BridgeConnectionResume />
        <PluginProvider>
          <AppShell>{children}</AppShell>
          <SpreadsheetTables />
        </PluginProvider>
      </AuthProvider>
    </>
  );
}
