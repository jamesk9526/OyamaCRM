"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { buildDonorDailyNavigation, isDonorNavigationItemVisible } from "./sidebar-configs";
export default function DonorWorkspaceTabs() {
  const path = usePathname(); const { user } = useAuth();
  const items = buildDonorDailyNavigation({ qbEnabled: false }).flatMap(group => group.items).filter(item => ["dashboard", "constituents", "donations", "campaigns", "reports", "tasks"].includes(item.id) && isDonorNavigationItemVisible(item, user));
  return <nav aria-label="Donor workspace pages" className="donor-reference-tabs">{items.map(item => <Link key={item.id} href={item.href} aria-current={(item.href === "/" ? path === "/" : path.startsWith(item.href)) ? "page" : undefined}>{item.id === "dashboard" ? "Home" : item.id === "constituents" ? "Contacts" : item.label}</Link>)}</nav>;
}
