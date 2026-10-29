"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, ArrowLeft, CalendarDays, ClipboardList, FileHeart, GraduationCap, HeartHandshake, LayoutGrid, LogOut, Menu, MessageSquare, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";

interface CareAccess { allowed: boolean; role: string; capabilities: string[] }
const CareContext = createContext<CareAccess | null>(null);
export function useCareAccess() { return useContext(CareContext); }
const navigation = [
  { name: "Today", href: "/compassion", icon: LayoutGrid, capability: "records" },
  { name: "Schedule", href: "/compassion/appointments", icon: CalendarDays, capability: "schedule" },
  { name: "Clients", href: "/compassion/clients", icon: Users, capability: "records" },
  { name: "Cases & follow-up", href: "/compassion/cases", icon: HeartHandshake, capability: "casework" },
  { name: "Clinical care", href: "/compassion/care", icon: FileHeart, capability: "clinical" },
  { name: "Intake", href: "/compassion/intake", icon: ClipboardList, capability: "casework" },
  { name: "Classes & assistance", href: "/compassion/classes", icon: GraduationCap, capability: "casework" },
  { name: "Messages", href: "/compassion/messages", icon: MessageSquare, capability: "messages" },
  { name: "Reports", href: "/compassion/reports", icon: Activity, capability: "export" },
  { name: "Migration", href: "/compassion/import/clients", icon: ArrowLeft, capability: "import" },
  { name: "Administration", href: "/compassion/settings", icon: Settings2, capability: "manage" },
];
export default function CompassionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, loading, signOut } = useAuth();
  const [access, setAccess] = useState<CareAccess | null>(null); const [error, setError] = useState(""); const [open, setOpen] = useState(false); const [attempt, setAttempt] = useState(0);
  const publicPage = pathname === "/compassion/login" || pathname.startsWith("/compassion/public/");
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
  const current = navigation.find((item) => item.href !== "/compassion" && pathname.startsWith(item.href)) ?? navigation[0];
  return <CareContext.Provider value={access}><div className="compassion-shell care-app">
    {open && <button className="care-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`care-sidebar ${open ? "is-open" : ""}`}>
      <Link href="/compassion" className="care-brand"><span><HeartHandshake size={25} /></span><div><strong>Compassion</strong><small>CLIENT CARE WORKSPACE</small></div></Link>
      <div className="care-sidebar-label">YOUR WORKSPACE</div>
      <nav aria-label="Client care navigation">{navigation.filter((item) => access?.capabilities.includes(item.capability)).map(({ name, href, icon: Icon }) => <Link key={href} onClick={() => setOpen(false)} href={href} aria-current={current.href === href ? "page" : undefined} className={current.href === href ? "active" : ""}><Icon size={18} /><span>{name}</span>{current.href === href && <i />}</Link>)}</nav>
      <div className="care-sidebar-footer"><ShieldCheck size={17} /><span>Confidential client workspace</span></div>
      <Link href="/apps" className="care-app-return"><LayoutGrid size={17} /> All Oyama apps</Link>
    </aside>
    <div className="care-main">
      <header className="care-topbar"><div className="care-actions"><button className="care-menu" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><span className="care-breadcrumb">Compassion <span>/</span> <strong>{current.name}</strong></span></div><div className="care-user"><span className="care-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span><div><strong>{user?.firstName} {user?.lastName}</strong><small>{access?.role.toLowerCase().replaceAll("_", " ")}</small></div><button title="Sign out" aria-label="Sign out of your account" onClick={async () => { await signOut(); router.replace("/compassion/login"); }}><LogOut size={17} /></button></div></header>
      <main className="care-content">{children}</main>
    </div>
  </div></CareContext.Provider>;
}
