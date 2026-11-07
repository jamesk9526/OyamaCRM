import { Activity, CalendarDays, ClipboardCheck, ClipboardList, FileText, GraduationCap, HeartHandshake, LayoutGrid, MessageSquare, Settings2, ShieldCheck, Stethoscope, Upload, Users, UserRoundCog, Clock3, DoorOpen, Globe, ScanLine } from "lucide-react";

import { MODULE_NAVIGATION } from "@/server/src/compassion/contracts/modules";
const icons = { Activity, CalendarDays, ClipboardCheck, ClipboardList, FileText, GraduationCap, HeartHandshake, LayoutGrid, MessageSquare, Stethoscope, Users, ScanLine };
export const careNavigation = (["Daily work", "Care & support", "Tools"] as const).map(label => ({ label, items: Object.values(MODULE_NAVIGATION).flat().filter(item=>item.group===label).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:icons[item.icon as keyof typeof icons] || LayoutGrid})) }));

export const careSettings = [
  { name: "Modules", href: "/compassion/settings/modules", icon: LayoutGrid, capability: "manage", description: "Enable modules and restrict access by care role." },
  { name: "Physician reviewers", href: "/compassion/settings/reviewers", icon: ShieldCheck, capability: "manage", description: "Provision ultrasound-only physician accounts and manage authentication." },
  { name: "Overview", href: "/compassion/settings", icon: Settings2, capability: "manage", description: "Your care workspace configuration and service readiness." },
  { name: "Staff directory", href: "/compassion/settings/staff", icon: Users, capability: "manage", description: "Manage staff profiles, volunteers, and scheduling visibility." },
  { name: "Access & roles", href: "/compassion/settings/access", icon: UserRoundCog, capability: "manage", description: "Assign care memberships and clinical permissions." },
  { name: "Rooms & resources", href: "/compassion/settings/resources", icon: DoorOpen, capability: "manage", description: "Configure rooms, equipment, and staff availability." },
  { name: "Website booking", href: "/compassion/settings/booking", icon: Globe, capability: "manage", description: "Configure public scheduling, form fields, and embed options." },
  { name: "Staff hours", href: "/compassion/settings/staff-hours", icon: Clock3, capability: "manage", description: "Record staff and volunteer service time." },
  { name: "Migration", href: "/compassion/settings/migration", icon: Upload, capability: "import", description: "Map, preview, and reconcile reviewed client imports." },
  { name: "Audit history", href: "/compassion/settings/audit", icon: ShieldCheck, capability: "manage", description: "Review access, charting, sharing, and administration events." },
];

export function carePathMatches(pathname: string, href: string) {
  return pathname === href || (href !== "/compassion" && href !== "/compassion/settings" && pathname.startsWith(`${href}/`));
}

export function carePageName(pathname: string) {
  if (pathname === "/compassion/clients/merge") return "Review duplicates";
  const setting = careSettings.find((item) => carePathMatches(pathname, item.href));
  if (setting) return setting.name === "Overview" ? "Settings" : setting.name;
  return careNavigation.flatMap((group) => group.items).find((item) => carePathMatches(pathname, item.href))?.name ?? "Compassion";
}
