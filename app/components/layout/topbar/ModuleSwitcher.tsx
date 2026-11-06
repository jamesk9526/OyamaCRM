"use client";

import { useDialogFocus } from "@/app/components/ui/useDialogFocus";
import { useState, useEffect, useMemo, useRef, useId, useCallback, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, ClipboardList, HeartHandshake, LayoutGrid, Search, Users, CalendarDays, FileText, Calculator, X } from "lucide-react";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import type { WorkspaceSettings } from "@/app/lib/workspace-settings";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { surveyWorkspaceAccess } from "@/app/components/surveys/client";
import "./workspace-switcher.css";

/** Workspace launcher with role-aware choices and a focused keyboard search. */
export default function ModuleSwitcher({ moduleKey, settings, scrolled = false }: { moduleKey: TopBarModuleKey; settings: WorkspaceSettings; scrolled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [surveyAccess, setSurveyAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [accessRetry, setAccessRetry] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 64 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(dialogRef, open, close, triggerRef);

  useEffect(() => {
    if (!open || !user) return;
    const controller = new AbortController();
    setCheckingAccess(true); setAccessError(false);
    surveyWorkspaceAccess(user.role === "compassion_user", controller.signal).then(access => {
      if (!controller.signal.aborted) setSurveyAccess(access.DONOR.includes("view") || access.CLIENT.includes("view"));
    }, () => {
      if (!controller.signal.aborted) { setSurveyAccess(false); setAccessError(true); }
    }).finally(() => { if (!controller.signal.aborted) setCheckingAccess(false); });
    return () => controller.abort();
  }, [open, user, accessRetry]);

  useEffect(() => { setOpen(false); setQuery(""); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (bounds) setPosition({ left: Math.max(12, Math.min(bounds.left, window.innerWidth - 572)), top: bounds.bottom + 10 });
    };
    reposition(); window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  const modules = useMemo(() => [
    { key: "donor", label: "DonorCRM", helper: "Donors, gifts & fundraising", href: "/", Icon: Users, tone: "blue", active: moduleKey === "donor" && !pathname.startsWith("/quickbooks-sync") },
    { key: "compassion", label: "Compassion CRM", helper: "Clients, care & follow-ups", href: "/compassion", Icon: HeartHandshake, tone: "rose", active: moduleKey === "compassion" },
    { key: "letters", label: "OyamaLetters", helper: "Letters & document studio", href: "/oyama-letters", Icon: FileText, tone: "violet", active: moduleKey === "letters" },
    { key: "events", label: "Events", helper: "Events, guests & operations", href: "/events", Icon: CalendarDays, tone: "amber", active: moduleKey === "events" },
    { key: "surveys", label: "Surveys", helper: "Forms, feedback & responses", href: "/surveys", Icon: ClipboardList, tone: "teal", active: moduleKey === "surveys" },
    { key: "quickbooks", label: "QuickBooks", helper: "Connection, review & gift sync", href: "/quickbooks-sync", Icon: Calculator, tone: "green", active: pathname.startsWith("/quickbooks-sync") },
  ].filter(workspace => {
    if (!user) return false;
    if (workspace.key === "surveys") return workspace.active || surveyAccess;
    if (user.role === "compassion_user") return workspace.key === "compassion";
    if (workspace.key === "donor") return settings.donorEnabled;
    if (workspace.key === "quickbooks") return settings.donorEnabled && ["admin", "manager", "staff"].includes(user.role);
    return true;
  }), [moduleKey, pathname, settings.donorEnabled, surveyAccess, user]);
  const current = modules.find(workspace => workspace.active) ?? modules[0];
  const filtered = modules.filter(workspace => `${workspace.label} ${workspace.helper}`.toLowerCase().includes(query.trim().toLowerCase()));

  function navigate(href: string) { setOpen(false); setQuery(""); router.push(href); }
  function navigateByKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const links = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-workspace-choice]") ?? []);
    if (!links.length) return;
    const index = links.indexOf(document.activeElement as HTMLButtonElement);
    const next = index < 0 ? (event.key === "ArrowDown" ? 0 : links.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    event.preventDefault(); links[next].focus();
  }

  if (!current) return null;
  const CurrentIcon = current.Icon;
  return <>
    <button ref={triggerRef} type="button" aria-label="Switch workspace" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
      onClick={() => { setQuery(""); setOpen(value => !value); }} className={`oyama-workspace-trigger ${scrolled ? "oyama-workspace-trigger--compact" : ""}`}>
      <span className={`oyama-workspace-icon oyama-workspace-icon--${current.tone}`}><CurrentIcon size={17} aria-hidden="true" /></span>
      <span className="oyama-workspace-trigger-copy"><span>Workspace</span><strong>{current.label}</strong></span>
      <ChevronDown size={14} aria-hidden="true" className={open ? "oyama-workspace-chevron-open" : ""} />
    </button>
    {open && createPortal(<div className="oyama-workspace-overlay">
      <div className="oyama-workspace-backdrop" onClick={close} aria-hidden="true" />
      <div ref={dialogRef} id={dialogId} role="dialog" aria-modal="true" aria-label="Switch workspace" tabIndex={-1}
        className="oyama-workspace-dialog" style={{ left: position.left, top: position.top }} onKeyDown={navigateByKeyboard}>
        <div className="oyama-workspace-heading"><span className="oyama-workspace-heading-icon"><LayoutGrid size={19} aria-hidden="true" /></span><div><h2>Your workspaces</h2><p>Choose where you want to work.</p></div><button type="button" onClick={close} aria-label="Close workspace switcher" className="oyama-workspace-close"><X size={18} aria-hidden="true" /></button></div>
        <div className="oyama-workspace-search"><Search size={17} aria-hidden="true" /><input data-modal-autofocus aria-label="Find a workspace" placeholder="Find a workspace..." value={query} onChange={event => setQuery(event.target.value)} /><kbd>Esc</kbd></div>
        <nav className="oyama-workspace-grid" aria-label="Available workspaces">
          {filtered.map(workspace => <button data-workspace-choice type="button" key={workspace.key} onClick={() => navigate(workspace.href)} aria-current={workspace.active ? "page" : undefined} className={`oyama-workspace-choice ${workspace.active ? "oyama-workspace-choice--current" : ""}`}>
            <span className={`oyama-workspace-icon oyama-workspace-icon--${workspace.tone}`}><workspace.Icon size={21} aria-hidden="true" /></span>
            <span className="oyama-workspace-choice-copy"><strong>{workspace.label}</strong><span>{workspace.helper}</span></span>
            {workspace.active ? <Check className="oyama-workspace-choice-indicator" size={16} aria-label="Current workspace" /> : <ArrowUpRight className="oyama-workspace-choice-indicator" size={16} aria-hidden="true" />}
          </button>)}
          {!filtered.length && <p className="oyama-workspace-empty" role="status">No workspaces match "{query}". Try another name.</p>}
        </nav>
        <div className="oyama-workspace-footer"><span>{checkingAccess ? "Checking workspace access..." : accessError ? "Survey access could not be checked." : `${modules.length} workspaces available`}</span>{accessError ? <button type="button" onClick={() => setAccessRetry(value => value + 1)}>Retry</button> : <span className="oyama-workspace-keyhint">Arrow keys to browse · Enter to open</span>}</div>
      </div>
    </div>, document.body)}
  </>;
}
