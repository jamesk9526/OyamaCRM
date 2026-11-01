"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUserRound, HelpCircle, LogOut, Palette, Settings2, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";

/** Account shortcuts link to canonical settings; workspace tools stay in navigation. */
export default function DonorAccountMenu({ helpHref, onSupport }: { helpHref: string; onSupport: () => void }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, open, () => setOpen(false));
  useEffect(() => setOpen(false), [pathname]);
  const name = user ? `${user.firstName} ${user.lastName}` : "Account";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "?";
  const links = [
    { label: "My profile", href: "/settings/profile", Icon: CircleUserRound },
    { label: "My appearance", href: "/settings/appearance", Icon: Palette },
    { label: "Settings", href: "/settings", Icon: Settings2 },
    { label: "Help & documentation", href: helpHref, Icon: HelpCircle },
  ];
  return <div className="relative">
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Open profile menu for ${name}`}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1.5 text-slate-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent-light)]">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">{initials}</span>
      <span className="hidden max-w-32 truncate text-xs font-medium min-[1500px]:block">{name}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <>
      <button type="button" tabIndex={-1} aria-label="Close account menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Account" tabIndex={-1}
        className="fixed right-2 top-14 z-50 w-72 max-w-[calc(100vw-1rem)] sm:absolute sm:right-0 sm:top-full sm:mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close account menu" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <nav aria-label="Account settings" className="space-y-1 p-2">
          {links.map(({ label, href, Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent)]"><Icon size={17} className="text-slate-500" aria-hidden="true" />{label}</Link>)}
          <button type="button" onClick={() => { setOpen(false); onSupport(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-slate-50"><HelpCircle size={17} className="text-slate-500" aria-hidden="true" />Get support</button>
        </nav>
        <div className="border-t border-slate-100 p-2"><button type="button" onClick={async () => { await signOut(); router.replace("/login"); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"><LogOut size={17} aria-hidden="true" />Sign out</button></div>
      </div>
    </>}
  </div>;
}
