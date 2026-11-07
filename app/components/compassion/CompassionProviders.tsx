"use client";
import { AuthProvider } from "../auth/AuthProvider";
import PWARegister from "../pwa/PWARegister";
import SpreadsheetTables from "../ui/crm/spreadsheet/SpreadsheetTables";
export default function CompassionProviders({children}:{children:React.ReactNode}) {
  return <><PWARegister/><AuthProvider>{children}<SpreadsheetTables/></AuthProvider></>;
}
