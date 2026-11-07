"use client";
import { usePathname } from "next/navigation";
import CompassionShell from "./CompassionShell";
export default function CompassionRouteShell({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/compassion/physician") ? <div className="compassion-shell care-physician-root">{children}</div> : <CompassionShell>{children}</CompassionShell>;
}
