"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import { apiFetch } from "@/app/lib/auth-client";

type ProviderKey = "propublica" | "sec_edgar";
type Confidence = "LOW" | "MEDIUM" | "HIGH";
type FindingStatus = "UNVERIFIED" | "VERIFIED" | "DISMISSED";

interface ConstituentOption { id: string; firstName: string; lastName: string; displayName?: string | null; organizationName?: string | null; entityKind?: string | null; email?: string | null; city?: string | null; state?: string | null; employer?: string | null; donorStatus: string; totalLifetimeGiving?: string; }
interface ProviderStatus { key: ProviderKey; name: string; configured: boolean; access: string; bestFor: string; limitation: string; }
interface ResearchResult { provider: ProviderKey; sourceRecordId: string; sourceUrl: string; signalType: string; title: string; subtitle: string; summary: string; disclosedAmount: number | null; disclosedAmountLabel: string | null; sourcePublishedAt: string | null; suggestedMatchConfidence: "LOW"; suggestedMatchRationale: string; facts: Array<{ label: string; value: string }>; }
interface Finding { id: string; provider: string; sourceUrl: string; title: string; summary: string; disclosedAmount?: string | number | null; disclosedAmountLabel?: string | null; matchConfidence: Confidence; matchRationale: string; status: FindingStatus; }

function displayName(row: ConstituentOption): string { return row.entityKind === "ORGANIZATION" ? row.organizationName || row.displayName || `${row.firstName} ${row.lastName}`.trim() : row.displayName || `${row.firstName} ${row.lastName}`.trim(); }
function money(value: string | number | null | undefined): string { const parsed = Number(value); return Number.isFinite(parsed) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(parsed) : "—"; }

export default function OyamaDonorProfileWorkspace({ initialConstituentId }: { initialConstituentId?: string }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ConstituentOption[]>([]);
  const [constituent, setConstituent] = useState<ConstituentOption | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [provider, setProvider] = useState<ProviderKey>("propublica");
  const [sourceQuery, setSourceQuery] = useState("");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviewing, setReviewing] = useState<ResearchResult | null>(null);
  const [confidence, setConfidence] = useState<Confidence>("LOW");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { void apiFetch<{ providers: ProviderStatus[] }>("/api/donor-profile/providers").then((response) => setProviders(response.providers)).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load OYAMA sources.")); }, []);
  useEffect(() => {
    if (!initialConstituentId) return;
    void apiFetch<ConstituentOption>(`/api/constituents/${encodeURIComponent(initialConstituentId)}`).then(async (row) => {
      setConstituent(row);
      setQuery(displayName(row));
      setSourceQuery(row.entityKind === "ORGANIZATION" ? row.organizationName || displayName(row) : row.employer || "");
      const response = await apiFetch<{ findings: Finding[] }>(`/api/donor-profile/findings?constituentId=${encodeURIComponent(row.id)}`);
      setFindings(response.findings);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load the selected constituent."));
  }, [initialConstituentId]);
  useEffect(() => {
    const value = query.trim();
    if (constituent && value === displayName(constituent)) { setMatches([]); return; }
    if (value.length < 2) { setMatches([]); return; }
    const timer = window.setTimeout(() => { void apiFetch<ConstituentOption[] | { items?: ConstituentOption[] }>(`/api/constituents?search=${encodeURIComponent(value)}&limit=8`).then((response) => setMatches(Array.isArray(response) ? response : response.items ?? [])).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Constituent search failed.")); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, constituent]);

  const selectedProvider = providers.find((item) => item.key === provider);
  const counts = useMemo(() => ({ review: findings.filter((item) => item.status === "UNVERIFIED").length, verified: findings.filter((item) => item.status === "VERIFIED").length, dismissed: findings.filter((item) => item.status === "DISMISSED").length }), [findings]);

  async function loadFindings(id: string) { const response = await apiFetch<{ findings: Finding[] }>(`/api/donor-profile/findings?constituentId=${encodeURIComponent(id)}`); setFindings(response.findings); }
  function selectConstituent(row: ConstituentOption) { setConstituent(row); setQuery(displayName(row)); setMatches([]); setResults([]); setReviewing(null); setSourceQuery(row.entityKind === "ORGANIZATION" ? row.organizationName || displayName(row) : row.employer || ""); setError(null); void loadFindings(row.id).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load profile evidence.")); }

  async function searchSource() {
    if (!constituent) { setError("Choose the CRM record this research belongs to."); return; }
    if (sourceQuery.trim().length < 2) { setError(provider === "sec_edgar" ? "Enter a valid SEC CIK." : "Enter a foundation or nonprofit name."); return; }
    setBusy(true); setError(null); setNotice(null); setReviewing(null);
    try { const response = await apiFetch<{ results: ResearchResult[] }>("/api/donor-profile/lookup", { method: "POST", body: JSON.stringify({ provider, query: sourceQuery.trim() }) }); setResults(response.results); if (!response.results.length) setNotice("No approved public-source records matched."); }
    catch (requestError) { setResults([]); setError(requestError instanceof Error ? requestError.message : "The OYAMA source lookup failed."); }
    finally { setBusy(false); }
  }

  function beginReview(result: ResearchResult) { setReviewing(result); setConfidence(result.suggestedMatchConfidence); setRationale(result.suggestedMatchRationale); }
  async function saveEvidence() {
    if (!constituent || !reviewing) return;
    if (rationale.trim().length < 12) { setError("Explain why the source record may match before saving it."); return; }
    setBusy(true); setError(null);
    try { await apiFetch("/api/donor-profile/findings", { method: "POST", body: JSON.stringify({ constituentId: constituent.id, ...reviewing, matchConfidence: confidence, matchRationale: rationale.trim() }) }); await loadFindings(constituent.id); setReviewing(null); setNotice("Evidence saved as unverified. A staff reviewer must verify or dismiss it."); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save the evidence."); }
    finally { setBusy(false); }
  }
  async function reviewFinding(id: string, status: Exclude<FindingStatus, "UNVERIFIED">) { if (!constituent) return; try { await apiFetch(`/api/donor-profile/findings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadFindings(constituent.id); setNotice(status === "VERIFIED" ? "Evidence verified." : "Evidence dismissed and retained in the audit trail."); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to review the evidence."); } }

  return <div className="mx-auto max-w-[1720px] space-y-4 py-3 sm:py-4">
    <WorkspaceBreadcrumbBar items={[{ label: "Steward Insights", href: "/steward" }, { label: "OYAMADonorPROFILE" }]} statusLabel="Evidence first" metadata="Public prospect intelligence" accentTone="blue" />
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[linear-gradient(135deg,#f8fbff_0%,#edf6ff_55%,#ffffff_100%)] px-5 py-6 sm:px-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Oyama proprietary prospect intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">OYAMADonorPROFILE</h1><p className="mt-2 text-sm leading-6 text-slate-600">Build source-attributed public profiles without presenting estimates as verified net worth. Every identity match and evidence record remains explainable and reviewable.</p></div><div className="grid grid-cols-3 gap-2 sm:min-w-[330px]"><Stat label="Needs review" value={counts.review} tone="amber" /><Stat label="Verified" value={counts.verified} tone="green" /><Stat label="Dismissed" value={counts.dismissed} tone="slate" /></div></div></div>
      <div className="grid gap-px border-t border-slate-200 bg-slate-200 lg:grid-cols-3"><Guardrail title="Evidence, not guesses" detail="Every saved fact keeps its public source, date, match rationale, and review state." /><Guardrail title="Capacity is not net worth" detail="Public indicators and estimates remain labeled and separate from verified assets." /><Guardrail title="Fundraising use only" detail="No sensitive-trait scoring, FEC prospecting, or eligibility decisions." /></div>
    </section>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}{notice ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p> : null}
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_minmax(350px,0.85fr)]">
      <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm"><Heading step="1" title="Choose a CRM record" detail="Research stays scoped to one constituent." /><div className="p-4"><label htmlFor="profile-person" className="text-xs font-semibold text-slate-700">Name, email, or organization</label><input id="profile-person" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (constituent && event.target.value !== displayName(constituent)) setConstituent(null); }} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" placeholder="Search CRM records..." />{matches.length ? <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">{matches.map((row) => <button key={row.id} type="button" onClick={() => selectConstituent(row)} className="block w-full px-3 py-2.5 text-left hover:bg-blue-50"><span className="block text-sm font-semibold text-slate-900">{displayName(row)}</span><span className="block truncate text-xs text-slate-500">{[row.email, row.city, row.state].filter(Boolean).join(" · ")}</span></button>)}</div> : null}{constituent ? <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3"><div className="flex justify-between gap-2"><div><p className="font-semibold text-blue-950">{displayName(constituent)}</p><p className="text-xs text-blue-800">{[constituent.donorStatus, constituent.city, constituent.state].filter(Boolean).join(" · ")}</p></div><Link href={`/constituents/${encodeURIComponent(constituent.id)}`} className="text-xs font-semibold text-blue-700">CRM profile</Link></div><p className="mt-3 text-xs text-blue-700">Internal lifetime giving<br /><strong className="text-blue-950">{money(constituent.totalLifetimeGiving)}</strong></p></div> : <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-500">Select a record. OYAMA never creates donors or merges public identities automatically.</p>}</div></section>
      <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm"><Heading step="2" title="Search an approved source" detail="Results remain transient until reviewed and saved." /><div className="space-y-4 p-4"><div className="grid gap-2">{providers.map((item) => <button key={item.key} type="button" onClick={() => { setProvider(item.key); setResults([]); setReviewing(null); setSourceQuery(""); }} className={`rounded-lg border p-3 text-left ${provider === item.key ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200"}`}><span className="flex justify-between gap-2 text-sm font-semibold text-slate-950">{item.name}<small className={item.configured ? "text-emerald-700" : "text-amber-700"}>{item.configured ? "Ready" : "Setup"}</small></span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.bestFor}</span></button>)}</div>{selectedProvider ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"><strong>Access:</strong> {selectedProvider.access}<br /><strong>Limit:</strong> {selectedProvider.limitation}</p> : null}<form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void searchSource(); }}><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder={provider === "propublica" ? "Foundation or nonprofit name" : "SEC CIK"} disabled={!constituent || selectedProvider?.configured === false} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100" /><button disabled={!constituent || busy || selectedProvider?.configured === false} className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Searching…" : "Search source"}</button></form>{results.map((result) => <article key={`${result.provider}-${result.sourceRecordId}`} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{result.title}</h3><p className="text-xs text-slate-500">{result.subtitle}</p></div><a href={result.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-blue-700">Open original ↗</a></div><p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p><dl className="mt-3 grid gap-2 sm:grid-cols-2">{result.facts.map((fact) => <div key={fact.label} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-semibold uppercase text-slate-500">{fact.label}</dt><dd className="text-sm font-medium text-slate-900">{fact.value}</dd></div>)}</dl><button type="button" onClick={() => beginReview(result)} className="mt-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Review identity match</button></article>)}{reviewing ? <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-800">Human review required</p><h3 className="mt-1 font-semibold text-amber-950">{reviewing.title}</h3><div className="mt-3 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]"><label className="text-xs font-semibold">Confidence<select value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)} className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-2 py-2"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label><label className="text-xs font-semibold">Identity-match rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2" /></label></div><p className="mt-2 text-xs text-amber-800">Confidence measures identity matching—not wealth, affinity, or likelihood of a gift.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void saveEvidence()} disabled={busy} className="rounded-md bg-amber-800 px-3 py-2 text-xs font-semibold text-white">Save as unverified</button><button type="button" onClick={() => setReviewing(null)} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold">Cancel</button></div></div> : null}</div></section>
      <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm"><Heading step="3" title="Evidence review" detail="Verify or dismiss saved evidence." /><div className="space-y-3 p-4">{!constituent ? <p className="rounded-lg bg-slate-50 px-3 py-5 text-sm text-slate-500">Choose a CRM record to load evidence.</p> : !findings.length ? <p className="rounded-lg bg-slate-50 px-3 py-5 text-sm text-slate-500">No saved public evidence yet.</p> : findings.map((finding) => <article key={finding.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">{finding.status}</span><span className="text-[10px] uppercase text-slate-500">{finding.provider.replaceAll("_", " ")}</span></div><h3 className="mt-2 font-semibold text-slate-950">{finding.title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{finding.summary}</p>{finding.disclosedAmount != null ? <p className="mt-2 text-sm font-semibold">{finding.disclosedAmountLabel}: {money(finding.disclosedAmount)}</p> : null}<p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs"><strong>Identity confidence:</strong> {finding.matchConfidence}<br />{finding.matchRationale}</p><div className="mt-3 flex flex-wrap gap-2"><a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold">View evidence</a>{finding.status === "UNVERIFIED" ? <><button type="button" onClick={() => void reviewFinding(finding.id, "VERIFIED")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">Verify</button><button type="button" onClick={() => void reviewFinding(finding.id, "DISMISSED")} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold">Dismiss</button></> : null}</div></article>)}</div></section>
    </div>
  </div>;
}

function Heading({ step, title, detail }: { step: string; title: string; detail: string }) { return <div className="border-b border-slate-200 px-4 py-3"><div className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">{step}</span><div><h2 className="text-sm font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></div></div>; }
function Guardrail({ title, detail }: { title: string; detail: string }) { return <div className="bg-white px-5 py-4"><p className="text-xs font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p></div>; }
function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "green" | "slate" }) { const classes = tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"; return <div className={`rounded-lg border px-3 py-2 text-center ${classes}`}><p className="text-lg font-semibold tabular-nums">{value}</p><p className="text-[10px] font-semibold uppercase opacity-70">{label}</p></div>; }

