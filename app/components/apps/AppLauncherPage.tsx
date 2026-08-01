"use client";

import Link from "next/link";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";

type LauncherApp = {
  id: string;
  name: string;
  description: string;
  href: string;
  category: "Workspaces" | "Studios" | "Operations" | "Standalone";
  icon: typeof LayoutDashboard;
  tone: string;
  adminOnly?: boolean;
};

const APPS: LauncherApp[] = [
  { id: "donor", name: "Donor CRM", description: "Constituents, giving, campaigns, and stewardship work.", href: "/", category: "Workspaces", icon: LayoutDashboard, tone: "bg-[#eaf4fd] text-[#0f6cbd]" },
  { id: "compassion", name: "Compassion CRM", description: "Client care, cases, services, and coordinated support.", href: "/compassion/dashboard", category: "Workspaces", icon: Building2, tone: "bg-blue-50 text-blue-700" },
  { id: "events", name: "EventSTUDIO", description: "Event planning, registration, guests, and public experiences.", href: "/events/events", category: "Workspaces", icon: CalendarDays, tone: "bg-amber-50 text-amber-700" },
  { id: "email", name: "OyamaEmail", description: "Build, review, schedule, and monitor donor email delivery.", href: "/oyama-email", category: "Studios", icon: Mail, tone: "bg-cyan-50 text-cyan-700" },
  { id: "letters", name: "OyamaLetters", description: "Create branded letters, print output, and mail workflows.", href: "/oyama-letters", category: "Studios", icon: FileText, tone: "bg-rose-50 text-rose-700" },
  { id: "paths", name: "Steward Paths", description: "Automate review-first donor journeys across CRM touchpoints.", href: "/steward-paths/library", category: "Studios", icon: Activity, tone: "bg-emerald-50 text-emerald-700" },
  { id: "steward", name: "Steward Copilot", description: "Explore donor context and prepare reviewable CRM work with grounded AI assistance.", href: "/steward-ai-workspace", category: "Operations", icon: Sparkles, tone: "bg-violet-50 text-violet-700" },
  { id: "watchdog", name: "OyamaWatchdog", description: "Security operations, audit evidence, incident response, and feedback.", href: "/watchdog", category: "Operations", icon: ShieldCheck, tone: "bg-slate-100 text-slate-700", adminOnly: true },
  { id: "webmaster", name: "OyamaWebMaster", description: "Website operations, publishing, embeds, and web administration.", href: "/webmaster", category: "Operations", icon: Globe2, tone: "bg-indigo-50 text-indigo-700", adminOnly: true },
  { id: "password", name: "OyamaPASSWORD", description: "Manage shared credentials through the dedicated vault workspace.", href: "/apps/password-vault", category: "Standalone", icon: KeyRound, tone: "bg-sky-50 text-sky-700", adminOnly: true },
  { id: "trivia", name: "Trivia Software", description: "Run standalone trivia events, scoring, displays, and remote play.", href: "/apps/trivia", category: "Standalone", icon: BriefcaseBusiness, tone: "bg-fuchsia-50 text-fuchsia-700" },
];

const CATEGORIES: LauncherApp["category"][] = ["Workspaces", "Studios", "Operations", "Standalone"];

/** Full-page launcher for CRM workspaces and specialized product tools. */
export default function AppLauncherPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const visibleApps = APPS.filter((app) => !app.adminOnly || isAdmin);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Oyama Platform</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Apps</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Choose the workspace that matches the work in front of you.</p>
      </header>

      {CATEGORIES.map((category) => {
        const apps = visibleApps.filter((app) => app.category === category);
        if (apps.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{category}</h2>
            <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
              {apps.map((app) => {
                const Icon = app.icon;
                return (
                  <Link key={app.id} href={app.href} className="group min-h-[142px] bg-white p-4 transition-colors hover:bg-[#f8fbfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0f6cbd]">
                    <span className={`inline-flex h-9 w-9 items-center justify-center ${app.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900 group-hover:text-[#0f548c]">{app.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{app.description}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
