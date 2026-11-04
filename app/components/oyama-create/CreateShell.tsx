"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, ChartNoAxesCombined, FolderOpen, Home, LayoutTemplate, Megaphone, Menu, Send, Settings2, Sparkles, Users, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import type { Bootstrap } from "./types";
import { message } from "./types";
import "./oyama-create.css";
const CreateContext = createContext<Bootstrap>({ enabled: false, permissions: [], capabilities: [] });
export const useCreate = () => useContext(CreateContext);
const nav = [
  { label: "Home", href: "/oyama-create", icon: Home }, { label: "Campaigns", href: "/oyama-create/campaigns", icon: Megaphone },
  { label: "Library", href: "/oyama-create/library", icon: LayoutTemplate }, { label: "Audiences", href: "/oyama-create/audiences", icon: Users },
  { label: "Calendar", href: "/oyama-create/calendar", icon: CalendarDays }, { label: "Delivery", href: "/oyama-create/delivery", icon: Send },
  { label: "Results", href: "/oyama-create/results", icon: ChartNoAxesCombined }, { label: "Settings", href: "/oyama-create/settings", icon: Settings2 },
];
export default function CreateShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const pathname = usePathname();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0), [open, setOpen] = useState(false);
  useEffect(() => { if (!user) return; let active = true; void apiFetch<Bootstrap>("/api/oyama-create/bootstrap").then(value => { if (active) { setBootstrap(value); setError(""); } }).catch(error => { if (active) setError(message(error)); }); return () => { active = false; }; }, [user, attempt]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, []);
  useEffect(() => { const refresh = () => setAttempt(value => value + 1); window.addEventListener("oyama-create-config-updated", refresh); return () => window.removeEventListener("oyama-create-config-updated", refresh); }, []);
  if (loading) return <div className="oc-loading" role="status">Opening oyamaCreate…</div>;
  if (!user) return <div className="oc-loading"><h1>Sign in to oyamaCreate</h1><Link href="/login?next=%2Foyama-create">Sign in</Link></div>;
  return <div className="oc-app"><a className="oc-skip" href="#oc-main">Skip to workspace</a>
    <header className="oc-topbar"><div className="oc-brand"><button className="oc-icon-button oc-menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button><span className="oc-brand-mark"><Sparkles size={21} aria-hidden="true"/></span><Link href="/oyama-create" aria-label="oyamaCreate home">oyama<span>Create</span></Link><span className="oc-product-label">COMMUNICATIONS</span></div><div className="oc-toplinks"><Link href="/apps"><FolderOpen size={15}/>All apps</Link><span className="oc-avatar" title={`${user.firstName} ${user.lastName}`}>{user.firstName?.[0]}{user.lastName?.[0]}</span></div></header>
    {open && <button className="oc-nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside className={`oc-sidebar ${open ? "is-open" : ""}`}><div className="oc-nav-label">CREATE & CONNECT</div><nav aria-label="oyamaCreate">{nav.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={pathname === item.href || (item.href !== "/oyama-create" && pathname.startsWith(item.href)) ? "page" : undefined}><item.icon size={18} aria-hidden="true"/>{item.label}</Link>)}</nav><div className="oc-sidebar-bottom"><p>A thoughtful message.<br/>Every channel, connected.</p><Link href="/steward-paths"><Sparkles size={16}/>Steward Paths</Link><Link href="/"><ArrowLeft size={16}/>Donor CRM</Link></div></aside>
    <main id="oc-main" className="oc-main" tabIndex={-1}>{error ? <div className="oc-state oc-card"><h1>oyamaCreate could not open</h1><p role="alert">{error}</p><p>If the new campaign tables are not installed yet, run the oyamaCreate migration before opening this workspace.</p><button className="oc-button" onClick={() => setAttempt(attempt + 1)}>Try again</button><Link href="/communications?legacy=1">Open existing communications</Link></div> : !bootstrap ? <div className="oc-state" role="status">Loading workspace permissions…</div> : <CreateContext.Provider value={bootstrap}>{!bootstrap.enabled && <div className="oc-notice">Workspace preview. Live delivery is off for this organization. <Link href="/oyama-create/settings">Review setup</Link></div>}{children}</CreateContext.Provider>}</main>
  </div>;
}
