"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import DeleteLetterButton from "./DeleteLetterButton";
import type { GeneratedLetterSummary } from "./types";

const PAGE_SIZE = 100;
export default function GeneratedLettersLibrary() {
  const [letters, setLetters] = useState<GeneratedLetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const request = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async (offset = 0) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const rows = await apiFetch<GeneratedLetterSummary[]>(`/api/letters/generated?limit=${PAGE_SIZE}&offset=${offset}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(rows)) throw new Error("The generated-letter list was incomplete. Refresh to try again.");
      setLetters(current => offset ? [...current, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Generated letters could not be loaded.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  const visible = letters.filter(letter => `${letter.template?.name ?? ""} ${letter.constituent?.firstName ?? ""} ${letter.constituent?.lastName ?? ""} ${letter.constituent?.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <main className="letters-library letters-generated-library">
    <header className="letters-library-heading"><div><p className="letters-eyebrow">LETTER HISTORY</p><h1>Generated Letters</h1><p>Find recipient letters and remove the ones you no longer need.</p></div><Link href="/oyama-letters/generate" className="letters-button letters-button-primary"><Plus size={16} aria-hidden="true" />Generate Letters</Link></header>
    <section className="letters-library-content" aria-label="Generated letters" aria-busy={loading}>
      <div className="letters-library-toolbar"><label className="letters-search"><Search size={17} aria-hidden="true" /><input ref={searchInput} type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search loaded letters" placeholder="Search loaded letters by template or recipient…" /></label><button type="button" className="letters-button" disabled={loading} onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />Refresh letters</button></div>
      {notice ? <p role="status" className="letters-library-notice">{notice}</p> : null}
      {error ? <div role="alert" className="letters-library-error">{error} <button type="button" className="letters-button" disabled={loading} onClick={() => void load()}>Try again</button></div> : null}
      {loading && !letters.length ? <p role="status" className="p-6 text-sm text-slate-600">Loading generated letters…</p> : !error && !visible.length ? <div className="letters-library-empty"><FileText size={32} aria-hidden="true" /><h2>{search ? "No matching loaded letters" : "No generated letters yet"}</h2><p>{search ? "Try a recipient or template name, or load older letters below." : "Generated letters will appear here after you prepare a letter run."}</p>{search ? <button type="button" className="letters-button" onClick={() => setSearch("")}>Clear search</button> : null}</div> : null}
      {visible.length ? <div className="letters-template-list"><div className="letters-template-list-heading" aria-hidden="true"><span>Template & recipient</span><span>Contact</span><span>Status</span><span>Generated</span><span className="text-right">Remove</span></div>{visible.map(letter => {
        const recipient = letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}`.trim() : "Unknown recipient";
        const name = `${letter.template?.name ?? "Letter"} for ${recipient}`;
        return <article key={letter.id} className="letters-template-row"><div className="letters-template-name"><span className="letters-document-icon"><FileText size={20} aria-hidden="true" /></span><div><h2>{letter.template?.name ?? "Letter"}</h2><p>{recipient}</p></div></div><div className="letters-template-category">{letter.constituent?.email ?? "No email"}</div><span className="letters-template-status text-xs text-slate-600">{letter.status.toLowerCase().replaceAll("_", " ")}</span><p className="letters-template-updated">{new Date(letter.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p><div className="letters-template-actions"><DeleteLetterButton kind="generated" id={letter.id} name={name} onDeleted={() => { request.current?.abort(); setLoading(false); setLetters(current => current.filter(item => item.id !== letter.id)); setNotice(`Deleted ${name}.`); window.requestAnimationFrame(() => searchInput.current?.focus()); }} /></div></article>;
      })}</div> : null}
      <footer className="letters-library-footer"><span role="status">{loading ? "Loading…" : `${visible.length} shown · ${letters.length} loaded`}</span>{hasMore ? <button type="button" className="letters-button" disabled={loading} onClick={() => void load(letters.length)}>{loading ? "Loading…" : "Load older letters"}</button> : null}<span>Deletion requires typing delete.</span></footer>
    </section>
  </main>;
}
