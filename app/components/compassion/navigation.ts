import { Activity, CalendarDays, ClipboardCheck, ClipboardList, FileText, GraduationCap, HeartHandshake, LayoutGrid, MessageSquare, Settings2, ShieldCheck, Stethoscope, Upload, Users, UserRoundCog, Clock3, DoorOpen, Globe } from "lucide-react";

export const careNavigation = [
  { label: "Daily work", items: [
    { name: "Today", href: "/compassion", icon: LayoutGrid, capability: "records" },
    { name: "Schedule", href: "/compassion/appointments", icon: CalendarDays, capability: "schedule" },
    { name: "Clients", href: "/compassion/clients", icon: Users, capability: "records" },
    { name: "Follow-ups", href: "/compassion/follow-ups", icon: ClipboardCheck, capability: "casework" },
  ] },
  { label: "Care & support", items: [
    { name: "Cases", href: "/compassion/cases", icon: HeartHandshake, capability: "casework" },
    { name: "Intake", href: "/compassion/intake", icon: ClipboardList, capability: "casework" },
    { name: "Clinical care", href: "/compassion/care", icon: Stethoscope, capability: "clinical" },
    { name: "Classes & assistance", href: "/compassion/classes", icon: GraduationCap, capability: "casework" },
    { name: "Messages", href: "/compassion/messages", icon: MessageSquare, capability: "messages" },
  ] },
  { label: "Tools", items: [
    { name: "Client letters", href: "/compassion/letters", icon: FileText, capability: "casework" },
    { name: "Reports", href: "/compassion/reports", icon: Activity, capability: "export" },
  ] },
];

export const careSettings = [
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
