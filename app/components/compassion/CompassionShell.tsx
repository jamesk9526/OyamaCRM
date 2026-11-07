"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HeartHandshake, LayoutGrid, LogOut, Menu, Search, Settings2, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import { ClientFileProvider } from "./ClientFileContext";
import ClientTaskRail from "./ClientTaskRail";
import { moduleForPath, type EffectiveModules, type ModuleId } from "@/server/src/compassion/contracts/modules";
import { careNavigation, carePageName, carePathMatches, careSettings } from "./navigation";

export interface CareAccess { allowed: boolean; role: string; capabilities: string[]; modules?: EffectiveModules }
export function careModuleAvailable(access: CareAccess | null, id: ModuleId) { return access?.modules?.[id] ?? id !== "physician-review"; }
const CareContext = createContext<CareAccess | null>(null);
export function useCareAccess() { return useContext(CareContext); }
export default function CompassionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, loading, signOut } = useAuth();
  const [access, setAccess] = useState<CareAccess | null>(null); const [error, setError] = useState(""); const [open, setOpen] = useState(false); const [attempt, setAttempt] = useState(0);
  const [small,setSmall] = useState(false);
  useEffect(()=>{const media=window.matchMedia("(max-width: 760px)");const update=()=>setSmall(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  const [collapsed, setCollapsed] = useState(false); const rail = useRef<HTMLElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const publicPage = pathname === "/compassion/login" || pathname.startsWith("/compassion/public/");
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const targets = () => Array.from(rail.current?.querySelectorAll<HTMLElement>('a[href],button,summary,select,input') ?? []).filter(el => el.getClientRects().length > 0);
    targets()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") { const list = targets(); const first = list[0]; const last = list.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); previous?.focus(); };
  }, [open]);
  useEffect(() => {
    if (publicPage || loading) return;
    if (!user) { router.replace("/compassion/login"); return; }
    let active = true;
    apiFetch<CareAccess>("/api/compassion/access").then((value) => { if (active) { setAccess(value); setError(""); } }, (reason: Error) => { if (active) { setAccess(null); setError(reason.message || "Unable to verify Compassion access."); } });
    return () => { active = false; };
  }, [user, loading, publicPage, router, attempt]);
  if (publicPage) return <div className="compassion-shell care-public">{children}</div>;
  if (loading || (!access && !error)) return <div className="compassion-shell care-loading" role="status"><HeartHandshake size={38} /><p>Opening your care workspace…</p></div>;
  if (error) return <div className="compassion-shell care-loading"><ShieldCheck size={40} /><h1>Compassion access</h1><p role="alert">{error}</p><p>Your platform account needs a separate client-care membership.</p><div className="care-actions">{user?.role === "admin" && <button className="care-button" onClick={async () => { try { await apiFetch("/api/compassion/bootstrap", { method: "POST", body: JSON.stringify({ approve: true }) }); setError(""); setAttempt((x) => x + 1); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to initialize Compassion."); } }}>Initialize client-care workspace</button>}<button className="care-button secondary" onClick={() => setAttempt((x) => x + 1)}>Try again</button><Link className="care-button secondary" href="/apps">All apps</Link><button className="care-button secondary" onClick={async () => { await signOut(); router.replace("/compassion/login"); }}>Use another account</button></div></div>;
  const settingsVisible = careSettings.some((item) => access?.capabilities.includes(item.capability) && careModuleAvailable(access, moduleForPath(item.href)));
  return <CareContext.Provider value={access}><ClientFileProvider><div className={`compassion-shell care-app ${collapsed ? "rail-collapsed" : ""}`}>
    <a className="care-skip-link" href="#care-main-content">Skip to content</a>
    {open && <button className="care-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside ref={rail} className={`care-sidebar ${open ? "is-open" : ""}`} inert={collapsed && !open} aria-label="Compassion tools"><button className="care-rail-close" onClick={() => { setOpen(false); setCollapsed(true); trigger.current?.focus(); }} aria-label="Close navigation"><X size={18} /></button>
      <Link href="/compassion" className="care-brand"><span><HeartHandshake size={25} /></span><div><strong>Compassion</strong><small>CLIENT CARE WORKSPACE</small></div></Link>
      <div className="care-rail-scroll"><ClientTaskRail /><nav aria-label="Client care navigation">{careNavigation.map((group) => {
        const items = group.items.filter((item) => access?.capabilities.includes(item.capability) && careModuleAvailable(access, moduleForPath(item.href)));
        return items.length > 0 && <div className="care-nav-group" key={group.label}><div className="care-sidebar-label">{group.label}</div>{items.map(({ name, href, icon: Icon }) => <Link key={href} onClick={() => setOpen(false)} href={href} aria-current={carePathMatches(pathname, href) ? "page" : undefined} className={carePathMatches(pathname, href) ? "active" : ""}><Icon size={18} /><span>{name}</span></Link>)}</div>;
      })}</nav></div>
      {settingsVisible && <Link href="/compassion/settings" onClick={() => setOpen(false)} className={`care-settings-link ${pathname.startsWith("/compassion/settings") ? "active" : ""}`} aria-current={pathname.startsWith("/compassion/settings") ? "page" : undefined}><Settings2 size={18} /> Settings</Link>}
      <div className="care-sidebar-footer"><ShieldCheck size={17} /><span>Confidential client workspace</span></div>
      <Link href="/apps" className="care-app-return"><LayoutGrid size={17} /> All Oyama apps</Link>
    </aside>
    <div className="care-main" inert={open}>
      <header className="care-topbar"><div className="care-topbar-location"><button ref={trigger} className="care-menu" aria-expanded={small ? open : !collapsed} aria-label={small ? open ? "Close navigation" : "Open navigation" : collapsed ? "Open navigation" : "Collapse navigation"} onClick={() => { if (window.matchMedia("(max-width: 760px)").matches) { setCollapsed(false); setOpen(!open); } else setCollapsed(!collapsed); }}>{open ? <X /> : <Menu />}</button><span className="care-breadcrumb">Compassion <span>/</span> <strong>{carePageName(pathname)}</strong></span></div><form action="/compassion/clients" className="care-global-search" role="search" aria-label="Search client directory"><Search size={17} aria-hidden="true" /><input name="search" aria-label="Search clients" placeholder="Find a client…" type="search" /><button type="submit" aria-label="Find client">Search</button></form><div className="care-user"><span className="care-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span><div><strong>{user?.firstName} {user?.lastName}</strong><small>{access?.role.toLowerCase().replaceAll("_", " ")}</small></div><button title="Sign out" aria-label="Sign out of your account" onClick={async () => { await signOut(); router.replace("/compassion/login"); }}><LogOut size={17} /></button></div></header>
      <main id="care-main-content" className="care-content" tabIndex={-1}>{careModuleAvailable(access, moduleForPath(pathname)) ? children : <div className="care-empty"><ShieldCheck /><h1>Module unavailable</h1><p>This module is not enabled for your care role. Contact your Compassion administrator.</p></div>}</main>
    </div>
  </div></ClientFileProvider></CareContext.Provider>;
}
