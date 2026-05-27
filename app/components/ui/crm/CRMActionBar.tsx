/** Shared clean action strip for refreshed Donor CRM pages. */
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import WorkspaceRibbon, { type WorkspaceRibbonTab } from "@/app/components/workspace-ribbon/WorkspaceRibbon";

interface CRMActionBarProps {
  children: ReactNode;
  className?: string;
}

const DONOR_RIBBON_TABS: WorkspaceRibbonTab[] = [
  { label: "Home", href: "/" },
  { label: "Constituents", href: "/constituents" },
  { label: "Giving", href: "/donations" },
  { label: "Outreach", href: "/communications" },
  { label: "Reports", href: "/reports" },
  { label: "Data", href: "/data-tools" },
  { label: "Tools", href: "/settings" },
  { label: "View" },
];

function resolveActiveDonorRibbonTab(pathname: string): string {
  if (pathname.startsWith("/constituents") || pathname.startsWith("/contacts-manager")) return "Constituents";
  if (pathname.startsWith("/donations") || pathname.startsWith("/campaigns") || pathname.startsWith("/grants") || pathname.startsWith("/payments") || pathname.startsWith("/designations")) return "Giving";
  if (pathname.startsWith("/communications") || pathname.startsWith("/letters-printables") || pathname.startsWith("/oyama-letters") || pathname.startsWith("/email-builder") || pathname.startsWith("/livecom")) return "Outreach";
  if (pathname.startsWith("/reports") || pathname.startsWith("/steward-signals")) return "Reports";
  if (pathname.startsWith("/data-tools") || pathname.startsWith("/custom-fields")) return "Data";
  if (pathname.startsWith("/settings") || pathname.startsWith("/quickbooks-sync") || pathname.startsWith("/steward-paths") || pathname.startsWith("/tasks") || pathname.startsWith("/meetings")) return "Tools";
  return "Home";
}

/** CRMActionBar gives refreshed DonorCRM pages a compact Explorer-style ribbon surface. */
export default function CRMActionBar({ children, className = "" }: CRMActionBarProps) {
  const pathname = usePathname();
  const activeTab = resolveActiveDonorRibbonTab(pathname);
  const tabs = DONOR_RIBBON_TABS.map((tab) => ({ ...tab, active: tab.label === activeTab }));

  return (
    <WorkspaceRibbon tabs={tabs} className={className}>
      {children}
    </WorkspaceRibbon>
  );
}
