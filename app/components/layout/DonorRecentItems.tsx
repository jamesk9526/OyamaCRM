"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FileText, ChevronRight } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
type Entry = { href: string; label: string };
const recordPath = /^\/(constituents|donations|campaigns|grants)\/(?!new$|create$|import$)[a-zA-Z0-9_-]+$/;
export default function DonorRecentItems() {
  const { user } = useAuth(); const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>([]);
  const key = user ? `oyama:recent:${user.organizationId}:${user.id}` : null;
  useEffect(() => {
    setEntries([]); if (!key) return;
    try { const stored: unknown = JSON.parse(sessionStorage.getItem(key) || "[]"); if (Array.isArray(stored)) setEntries(stored.filter((item): item is Entry => Boolean(item && typeof item.href === "string" && recordPath.test(item.href) && typeof item.label === "string" && item.label.length <= 100)).slice(0, 5)); } catch { /* Storage is optional. */ }
  }, [key, pathname]);
  useEffect(() => {
    if (!key) return;
    const track = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element)?.closest?.("a"); if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin || !recordPath.test(url.pathname)) return;
      const label = (anchor.textContent || anchor.getAttribute("aria-label") || "Record").trim().replace(/\s+/g, " ").slice(0, 100);
      setEntries(previous => { const next = [{ href: url.pathname, label }, ...previous.filter(item => item.href !== url.pathname)].slice(0, 5); try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Still usable in memory. */ } return next; });
    };
    document.addEventListener("click", track, true); return () => document.removeEventListener("click", track, true);
  }, [key]);
  if (!user) return null;
  return <section className="donor-recent-items" aria-label="Recent records"><div className="flex items-center justify-between gap-2"><h2>Recent Records</h2>{entries.length > 0 && <button onClick={() => { setEntries([]); try { if (key) sessionStorage.removeItem(key); } catch { /* Optional storage. */ } }} className="text-[10px] text-blue-700">Clear</button>}</div>{entries.length ? <ul>{entries.map((item, index) => <li key={item.href}><Link href={item.href}><span className={`donor-recent-icon donor-recent-icon-${index % 3}`}><FileText size={12} /></span><span className="min-w-0 flex-1 truncate" title={item.label}>{item.label}</span><ChevronRight size={12} /></Link></li>)}</ul> : <p className="mt-2 text-xs leading-5 text-slate-600">Records you open will appear here for this browser session.</p>}</section>;
}
