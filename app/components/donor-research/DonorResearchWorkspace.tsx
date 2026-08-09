"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";

type ProviderKey = "propublica" | "sec_edgar";
type Confidence = "LOW" | "MEDIUM" | "HIGH";
type FindingStatus = "UNVERIFIED" | "VERIFIED" | "DISMISSED";

interface ConstituentOption {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  organizationName?: string | null;
  entityKind?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  employer?: string | null;
  occupation?: string | null;
  type: string;
  donorStatus: string;
  totalLifetimeGiving?: string;
}

interface ProviderStatus {
  key: ProviderKey;
  name: string;
  configured: boolean;
  access: string;
  bestFor: string;
  limitation: string;
}

interface PublicResearchResult {
  provider: ProviderKey;
  sourceRecordId: string;
  sourceUrl: string;
  signalType: string;
  title: string;
  subtitle: string;
  summary: string;
  disclosedAmount: number | null;
  disclosedAmountLabel: string | null;
  sourcePublishedAt: string | null;
  suggestedMatchConfidence: "LOW";
  suggestedMatchRationale: string;
  facts: Array<{ label: string; value: string }>;
}

interface Finding {
  id: string;
  constituentId: string;
  provider: ProviderKey;
  sourceRecordId?: string | null;
  sourceUrl: string;
  signalType: string;
  title: string;
  summary: string;
  disclosedAmount?: string | number | null;
  disclosedAmountLabel?: string | null;
  sourcePublishedAt?: string | null;
  matchConfidence: Confidence;
  matchRationale: string;
  status: FindingStatus;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string } | null;
  reviewedBy?: { firstName: string; lastName: string } | null;
}

function displayName(constituent: ConstituentOption): string {
  if (constituent.entityKind === "ORGANIZATION") {
    return constituent.organizationName || constituent.displayName || `${constituent.firstName} ${constituent.lastName}`.trim();
  }
  return constituent.displayName || `${constituent.firstName} ${constituent.lastName}`.trim();
}

function money(value: string | number | null | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number);
}

function date(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DonorResearchWorkspace({ initialConstituentId }: { initialConstituentId?: string }) {
  const [constituentQuery, setConstituentQuery] = useState("");
  const [constituentResults, setConstituentResults] = useState<ConstituentOption[]>([]);
  const [selectedConstituent, setSelectedConstituent] = useState<ConstituentOption | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [provider, setProvider] = useState<ProviderKey>("propublica");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<PublicResearchResult[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviewingResult, setReviewingResult] = useState<PublicResearchResult | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<Confidence>("LOW");
  const [matchRationale, setMatchRationale] = useState("");
  const [searchingConstituents, setSearchingConstituents] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ providers: ProviderStatus[] }>("/api/donor-research/providers")
      .then((response) => setProviderStatuses(response.providers))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load public-source status."));
  }, []);

  useEffect(() => {
    if (!initialConstituentId) return;
    void apiFetch<ConstituentOption>(`/api/constituents/${encodeURIComponent(initialConstituentId)}`)
      .then((constituent) => {
        setSelectedConstituent(constituent);
        setConstituentQuery(displayName(constituent));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load the selected constituent."));
  }, [initialConstituentId]);

  useEffect(() => {
    const query = constituentQuery.trim();
    if (selectedConstituent && query === displayName(selectedConstituent)) {
      setConstituentResults([]);
      return;
    }
    if (query.length < 2) {
      setConstituentResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchingConstituents(true);
      void apiFetch<ConstituentOption[] | { items?: ConstituentOption[] }>(`/api/constituents?search=${encodeURIComponent(query)}&limit=8`)
        .then((response) => setConstituentResults(Array.isArray(response) ? response : response.items ?? []))
        .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Constituent search failed."))
        .finally(() => setSearchingConstituents(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [constituentQuery, selectedConstituent]);

  useEffect(() => {
    if (!selectedConstituent) {
      setFindings([]);
      return;
    }
    void loadFindings(selectedConstituent.id);
  }, [selectedConstituent]);

  const providerStatus = providerStatuses.find((item) => item.key === provider);
  const statusCounts = useMemo(() => ({
    unverified: findings.filter((finding) => finding.status === "UNVERIFIED").length,
    verified: findings.filter((finding) => finding.status === "VERIFIED").length,
    dismissed: findings.filter((finding) => finding.status === "DISMISSED").length,
  }), [findings]);

  async function loadFindings(constituentId: string) {
    try {
      const response = await apiFetch<{ findings: Finding[] }>(`/api/donor-research/findings?constituentId=${encodeURIComponent(constituentId)}`);
      setFindings(response.findings);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load research findings.");
    }
  }

  function selectConstituent(constituent: ConstituentOption) {
    setSelectedConstituent(constituent);
    setConstituentQuery(displayName(constituent));
    setConstituentResults([]);
    setSourceResults([]);
    setReviewingResult(null);
    setNotice(null);
    setError(null);
    if (constituent.entityKind === "ORGANIZATION") {
      setSourceQuery(constituent.organizationName || displayName(constituent));
    } else if (constituent.employer) {
      setSourceQuery(constituent.employer);
    }
  }

  async function runLookup() {
    if (!selectedConstituent) {
      setError("Choose the constituent whose record you are researching first.");
      return;
    }
    if (sourceQuery.trim().length < 2) {
      setError(provider === "sec_edgar" ? "Enter a valid SEC CIK." : "Enter a foundation or nonprofit name.");
      return;
    }
    setLookingUp(true);
    setError(null);
    setNotice(null);
    setReviewingResult(null);
    try {
      const response = await apiFetch<{ results: PublicResearchResult[] }>("/api/donor-research/lookup", {
        method: "POST",
        body: JSON.stringify({ provider, query: sourceQuery.trim() }),
      });
      setSourceResults(response.results);
      if (response.results.length === 0) setNotice("No public records matched this query. Try a more exact organization name or identifier.");
    } catch (requestError) {
      setSourceResults([]);
      setError(requestError instanceof Error ? requestError.message : "The public source lookup failed.");
    } finally {
      setLookingUp(false);
    }
  }

  function beginReview(result: PublicResearchResult) {
    setReviewingResult(result);
    setMatchConfidence(result.suggestedMatchConfidence);
    setMatchRationale(result.suggestedMatchRationale);
    setError(null);
    setNotice(null);
  }

  async function saveFinding() {
    if (!selectedConstituent || !reviewingResult) return;
    if (matchRationale.trim().length < 12) {
      setError("Explain how this source record may match the constituent before saving it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/donor-research/findings", {
        method: "POST",
        body: JSON.stringify({
          constituentId: selectedConstituent.id,
          ...reviewingResult,
          matchConfidence,
          matchRationale: matchRationale.trim(),
        }),
      });
      await loadFindings(selectedConstituent.id);
      setReviewingResult(null);
      setNotice("Finding saved as unverified. A staff reviewer must verify or dismiss it before it is treated as confirmed research.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save the research finding.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewFinding(finding: Finding, status: Exclude<FindingStatus, "UNVERIFIED">) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/donor-research/findings/${encodeURIComponent(finding.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (selectedConstituent) await loadFindings(selectedConstituent.id);
      setNotice(status === "VERIFIED" ? "Finding marked verified." : "Finding dismissed and retained in the audit trail.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update the research finding.");
    }
  }

  return (
    <div className="mx-auto max-w-[1720px] space-y-4 py-3 sm:py-4">
      <WorkspaceBreadcrumbBar
        items={[{ label: "Donor CRM", href: "/" }, { label: "Donor Research" }]}
        statusLabel="Review-first"
        metadata="Public-source evidence"
        accentTone="blue"
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_52%,#ffffff_100%)] px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Oyama Donor CRM / Prospect research</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Donor Research</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Find public foundation, nonprofit, and SEC filing evidence; document why it may match; and keep every result unverified until a staff review.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
              <Stat label="Needs review" value={statusCounts.unverified} tone="amber" />
              <Stat label="Verified" value={statusCounts.verified} tone="green" />
              <Stat label="Dismissed" value={statusCounts.dismissed} tone="slate" />
            </div>
          </div>
        </div>
        <div className="grid gap-px border-t border-slate-200 bg-slate-200 lg:grid-cols-3">
          <Guardrail title="Disclosed facts only" detail="Oyama stores source facts and amounts as reported. It does not invent a net-worth estimate." />
          <Guardrail title="Human match review" detail="Name results begin at low confidence. Verify identifiers and relationships in the original record." />
          <Guardrail title="Minimal retention" detail="Transient lookup results are not saved until you document a rationale and choose Save for review." />
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading step="1" title="Choose a constituent" detail="Research is always linked to one CRM record." />
          <div className="p-4">
            <label className="text-xs font-semibold text-slate-700" htmlFor="donor-research-constituent">Name, email, or organization</label>
            <div className="relative mt-1.5">
              <input
                id="donor-research-constituent"
                type="search"
                value={constituentQuery}
                onChange={(event) => {
                  setConstituentQuery(event.target.value);
                  if (selectedConstituent && event.target.value !== displayName(selectedConstituent)) setSelectedConstituent(null);
                }}
                placeholder="Search CRM records..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {searchingConstituents ? <span className="absolute right-3 top-3 text-xs text-slate-400">Searching…</span> : null}
            </div>
            {constituentResults.length > 0 ? (
              <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {constituentResults.map((constituent) => (
                  <button key={constituent.id} type="button" onClick={() => selectConstituent(constituent)} className="block w-full px-3 py-2.5 text-left hover:bg-blue-50">
                    <p className="text-sm font-semibold text-slate-900">{displayName(constituent)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{[constituent.email, constituent.city, constituent.state].filter(Boolean).join(" · ") || constituent.type}</p>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedConstituent ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-950">{displayName(selectedConstituent)}</p>
                    <p className="mt-1 text-xs text-blue-800">{[selectedConstituent.type, selectedConstituent.donorStatus, selectedConstituent.city, selectedConstituent.state].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Link href={`/constituents/${encodeURIComponent(selectedConstituent.id)}`} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Profile</Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-blue-700">CRM lifetime giving</dt><dd className="font-semibold text-blue-950">{money(selectedConstituent.totalLifetimeGiving)}</dd></div>
                  <div><dt className="text-blue-700">Employer</dt><dd className="truncate font-semibold text-blue-950">{selectedConstituent.employer || "Not recorded"}</dd></div>
                </dl>
              </div>
            ) : <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-500">Select an existing record. The tool will never create a donor or merge identities automatically.</p>}
          </div>
        </section>

        <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading step="2" title="Search a public source" detail="Lookup results remain transient until saved." />
          <div className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {providerStatuses.map((item) => (
                <button key={item.key} type="button" onClick={() => { setProvider(item.key); setSourceResults([]); setReviewingResult(null); setSourceQuery(""); }} className={`rounded-lg border p-3 text-left transition ${provider === item.key ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-950">{item.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{item.configured ? "Ready" : "Setup"}</span></div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.bestFor}</p>
                </button>
              ))}
            </div>
            {providerStatus ? <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">Limit:</span> {providerStatus.limitation}</div> : null}
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void runLookup(); }}>
              <input
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder={provider === "propublica" ? "Foundation or nonprofit name" : "SEC CIK (1–10 digits)"}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                disabled={!selectedConstituent || providerStatus?.configured === false}
              />
              <button type="submit" disabled={!selectedConstituent || lookingUp || providerStatus?.configured === false} className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{lookingUp ? "Searching…" : "Search source"}</button>
            </form>

            <div className="space-y-3">
              {sourceResults.map((result) => (
                <article key={`${result.provider}-${result.sourceRecordId}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><h3 className="font-semibold text-slate-950">{result.title}</h3><p className="mt-0.5 text-xs text-slate-500">{result.subtitle}</p></div>
                    <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Open original ↗</a>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {result.facts.map((fact) => <div key={fact.label} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{fact.label}</dt><dd className="mt-0.5 text-sm font-medium text-slate-900">{fact.value}</dd></div>)}
                  </dl>
                  <button type="button" onClick={() => beginReview(result)} className="mt-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">Review match before saving</button>
                </article>
              ))}
            </div>

            {reviewingResult ? (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">Match review required</p>
                <h3 className="mt-1 font-semibold text-amber-950">{reviewingResult.title}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <label className="text-xs font-semibold text-amber-950">Confidence<select value={matchConfidence} onChange={(event) => setMatchConfidence(event.target.value as Confidence)} className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-2.5 py-2 text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
                  <label className="text-xs font-semibold text-amber-950">Why this may be the same person or entity<textarea value={matchRationale} onChange={(event) => setMatchRationale(event.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm leading-5" /></label>
                </div>
                <p className="mt-2 text-xs leading-5 text-amber-800">Saving creates an unverified evidence record. Confidence describes identity matching, not the likelihood of a gift.</p>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void saveFinding()} disabled={saving} className="rounded-md bg-amber-800 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50">{saving ? "Saving…" : "Save for review"}</button><button type="button" onClick={() => setReviewingResult(null)} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900">Cancel</button></div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading step="3" title="Review the research record" detail="Verified and dismissed decisions remain traceable." />
          <div className="space-y-3 p-4">
            {!selectedConstituent ? <EmptyResearch message="Choose a constituent to view their research record." /> : findings.length === 0 ? <EmptyResearch message="No findings have been saved for this constituent. Run a source lookup to begin." /> : findings.map((finding) => (
              <article key={finding.id} className={`rounded-xl border p-4 ${finding.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50/40" : finding.status === "DISMISSED" ? "border-slate-200 bg-slate-50 opacity-75" : "border-amber-200 bg-amber-50/40"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2"><div><StatusBadge status={finding.status} /><h3 className="mt-2 font-semibold text-slate-950">{finding.title}</h3></div><a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">Source ↗</a></div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{finding.summary}</p>
                {finding.disclosedAmount != null ? <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">{finding.disclosedAmountLabel || "Disclosed amount"}: {money(finding.disclosedAmount)}</p> : null}
                <dl className="mt-3 space-y-2 text-xs"><div><dt className="font-semibold text-slate-500">Match confidence</dt><dd className="text-slate-800">{finding.matchConfidence}</dd></div><div><dt className="font-semibold text-slate-500">Match rationale</dt><dd className="mt-0.5 leading-5 text-slate-700">{finding.matchRationale}</dd></div><div><dt className="font-semibold text-slate-500">Evidence date</dt><dd className="text-slate-700">{date(finding.sourcePublishedAt)} · saved {date(finding.createdAt)}</dd></div></dl>
                {finding.status === "UNVERIFIED" ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void reviewFinding(finding, "VERIFIED")} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Verify finding</button><button type="button" onClick={() => void reviewFinding(finding, "DISMISSED")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Dismiss</button></div> : finding.reviewedBy ? <p className="mt-3 text-xs text-slate-500">Reviewed by {finding.reviewedBy.firstName} {finding.reviewedBy.lastName} on {date(finding.reviewedAt)}</p> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ step, title, detail }: { step: string; title: string; detail: string }) {
  return <div className="border-b border-slate-200 px-4 py-3.5"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{step}</span><div><h2 className="text-sm font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p></div></div></div>;
}

function Guardrail({ title, detail }: { title: string; detail: string }) {
  return <div className="bg-white px-4 py-3"><p className="text-xs font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "green" | "slate" }) {
  const colors = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-950" : tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-950";
  return <div className={`rounded-lg border px-3 py-2 text-center ${colors}`}><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p></div>;
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const colors = status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : status === "DISMISSED" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors}`}>{status.toLowerCase()}</span>;
}

function EmptyResearch({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}
