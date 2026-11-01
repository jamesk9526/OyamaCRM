"use client";
import AppLauncherIcon from "../AppLauncherIcon";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { CircleHelp as HelpCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
interface UserMenuProps {
  moduleKey: TopBarModuleKey;
  showApps: boolean;
  onOpenApps: () => void;
  onOpenFeedback: () => void;
  helpHref: string;
}

/** UserMenu: avatar with account, workspace tools, and role-aware admin controls. */
export default function UserMenu({
  moduleKey,
  showApps,
  onOpenApps,
  onOpenFeedback,
  helpHref,
}: UserMenuProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";
  const canSeeAdminMenu = user?.role === "admin" || user?.role === "super_admin";
  const adminLinks: Array<{ label: string; href: string; icon: string; openInNewTab?: boolean }> = [
    { label: "Settings Home", href: "/settings", icon: "M10.3 4.3c.4-1.8 2.9-1.8 3.4 0 .2.8.9 1.3 1.7 1.3.3 0 .6-.1.9-.2 1.5-.9 3.3.8 2.4 2.4-.5.8-.2 1.9.7 2.3 1.8.4 1.8 2.9 0 3.4-.8.2-1.3.9-1.3 1.7 0 .3.1.6.2.9.9 1.5-.8 3.3-2.4 2.4-.8-.5-1.9-.2-2.3.7-.4 1.8-2.9 1.8-3.4 0-.2-.8-.9-1.3-1.7-1.3-.3 0-.6.1-.9.2-1.5.9-3.3-.8-2.4-2.4.5-.8.2-1.9-.7-2.3-1.8-.4-1.8-2.9 0-3.4.8-.2 1.3-.9 1.3-1.7 0-.3-.1-.6-.2-.9-.9-1.5.8-3.3 2.4-2.4.8.5 1.9.2 2.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z" },
    { label: "Users", href: "/settings/users", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" },
    { label: "Roles", href: "/settings/roles", icon: "M12 3l7 4v5c0 4.5-2.9 8.5-7 9-4.1-.5-7-4.5-7-9V7l7-4zm-2 9 1.5 1.5L15 10" },
    { label: "Security", href: "/settings/security", icon: "M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" },
    { label: "Modules", href: "/settings/modules", icon: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" },
    { label: "Reports", href: "/reports", icon: "M4 19h16M7 15V9m5 6V5m5 10v-3" },
    { label: "Imports", href: "/data-tools/import", icon: "M12 3v10m0 0 4-4m-4 4-4-4M5 17v2h14v-2" },
    { label: "Data Tools", href: "/data-tools", icon: "M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4zm0 0c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4zm-9 9c0 2.2 4 4 9 4s9-1.8 9-4" },
    { label: "Custom Fields", href: "/custom-fields", icon: "M4 6h16M4 10h10M4 14h16M4 18h8M16 8v4m-2-2h4" },
    { label: "Audit Log", href: "/settings/audit", icon: "M7 4h10M7 8h10M7 12h6m-8 8h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  ];

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function runProfileAction(action: () => void) {
    setOpen(false);
    action();
  }

  const avatarCls = moduleKey === "events"
      ? "bg-violet-700 border-violet-200"
      : moduleKey === "watchdog"
        ? "bg-red-700 border-red-200"
        : moduleKey === "webmaster"
          ? "bg-indigo-700 border-indigo-200"
          : moduleKey === "oshareview"
              ? "bg-cyan-700 border-cyan-200"
          : "bg-indigo-700 border-indigo-200";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Open profile menu for ${user.firstName} ${user.lastName}` : "Open profile menu"}
        data-mobile-touch="true"
        title={user ? `${user.firstName} ${user.lastName}` : "Account"}
        className={`inline-flex h-11 max-w-[12rem] shrink-0 items-center gap-2 rounded-[18px] border px-1.5 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 max-[480px]:h-10 max-[480px]:w-10 max-[480px]:justify-center max-[480px]:rounded-full max-[480px]:p-0 ${moduleKey === "donor" ? "border-transparent text-white hover:bg-white/[0.08] focus-visible:ring-emerald-300/70" : "border-transparent hover:bg-slate-50/90"}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] max-[480px]:h-9 max-[480px]:w-9 max-[480px]:text-xs ${avatarCls}`}>
          {initials}
        </span>
        <span className="hidden min-w-0 leading-tight min-[1400px]:block">
          <span className={`block max-w-[132px] truncate text-sm font-semibold ${moduleKey === "donor" ? "text-white" : "text-slate-900"}`}>
            {user ? `${user.firstName} ${user.lastName}` : "Account"}
          </span>
          <span className={`block max-w-[132px] truncate text-xs ${moduleKey === "donor" ? "text-slate-400" : "text-slate-500"}`}>Oyama Organization</span>
        </span>
        <svg className={`hidden h-4 w-4 transition-transform xl:block ${moduleKey === "donor" ? "text-slate-300" : "text-slate-500"} ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="fixed inset-x-2 bottom-2 z-50 max-h-[calc(100dvh-1rem)] w-auto overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_24px_72px_rgba(2,6,23,0.22)] xl:absolute xl:inset-x-auto xl:right-0 xl:bottom-auto xl:top-full xl:mt-2 xl:max-h-[min(80vh,44rem)] xl:w-[min(25rem,calc(100vw-1rem))] xl:pb-0">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.12),transparent_42%),linear-gradient(90deg,#ffffff,#f8fafc)] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ${avatarCls}`}>
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      {user?.role}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Profile
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">More Tools</p>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">Workspace</span>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <Link
                  href="/settings/profile"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 00-16 0m12-13a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="min-w-0 truncate">My profile</span>
                </Link>
                {showApps ? (
                  <button
                    type="button"
                    onClick={() => runProfileAction(onOpenApps)}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <AppLauncherIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">Apps</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => runProfileAction(onOpenFeedback)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                  </svg>
                  <span className="min-w-0 truncate">Get support</span>
                </button>
                {moduleKey === "donor" ? (
                  <Link
                    href="/settings/appearance"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M3 12h2m14 0h2m-3.64-5.64 1.42-1.42M5.22 18.78l1.42-1.42m0-10.72L5.22 5.22m13.56 13.56-1.42-1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="min-w-0 truncate">My appearance</span>
                  </Link>
                ) : null}
                <Link
                  href="/steward-ai-workspace"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <StewardAvatarIcon size={14} alt="Steward" className="ring-slate-300/80" />
                  <span className="min-w-0 truncate">Steward</span>
                </Link>
                <Link
                  href={helpHref}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <HelpCircleIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 truncate">Help</span>
                </Link>
              </div>
            </div>

            {canSeeAdminMenu ? (
              <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3.5 py-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Admin Controls</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Organization configuration and governance tools</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Admin</span>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  {adminLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.openInNewTab ? "_blank" : undefined}
                      rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                      </svg>
                      <span className="min-w-0 truncate">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="bg-slate-50/60 px-2.5 py-2">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
