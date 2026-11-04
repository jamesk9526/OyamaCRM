"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { FileText, Globe, Mail, MessageSquare, Share2, X } from "lucide-react";
import type { Channel } from "./types";
import { channelNames } from "./types";
export const channelIcons = { EMAIL: Mail, LETTER: FileText, WEB: Globe, SMS: MessageSquare, SOCIAL: Share2 };
export function Channels({ channels }: { channels: Channel[] }) { return <div className="oc-channel-pills">{channels.map(channel => { const Icon = channelIcons[channel]; return <span className="oc-channel-pill" key={channel}><Icon size={11} aria-hidden="true"/>{channelNames[channel]}</span>; })}</div>; }
export function Status({ status }: { status: string }) { return <span className={`oc-status ${status.toLowerCase()}`}>{status.toLowerCase().replaceAll("_", " ")}</span>; }
export function Heading({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) { return <div className="oc-page-heading"><div>{eyebrow && <div className="oc-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) { return <div className="oc-state"><FileText size={30} aria-hidden="true"/><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current; root?.querySelector<HTMLElement>("input,button,select,textarea")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(node => node.offsetParent !== null);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  return <div className="oc-dialog-backdrop"><div ref={ref} className="oc-dialog" style={wide ? { maxWidth: 1200, width: "95vw" } : undefined} role="dialog" aria-modal="true" aria-label={title}><div className="oc-actions" style={{ justifyContent: "space-between", marginBottom: 18 }}><h2>{title}</h2><button className="oc-icon-button" onClick={close} aria-label="Close dialog"><X size={17}/></button></div>{children}</div></div>;
}
