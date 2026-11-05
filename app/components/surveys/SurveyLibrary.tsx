"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { ArrowRight, ClipboardList, FilePlus2, LayoutTemplate, Plus } from "lucide-react";
import type { Definition } from "@/server/src/surveys/definition";
import { audiences, formatDate, identities, message, statusLabels, surveyHref, surveyRequest, surveyWorkspaceAccess, surveyWrite,
  type Access, type Audience, type Identity, type SurveyCard } from "./client";
import SurveyDialog from "./SurveyDialog";

type LibraryResult = { items: SurveyCard[]; page: number; total: number };
type Template = { id: string; definition: Definition };

export default function SurveyLibrary({ initialAudience }: { initialAudience?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const careOnly = user?.role === "compassion_user";
  const [access, setAccess] = useState<Access | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [result, setResult] = useState<LibraryResult | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [identity, setIdentity] = useState<Identity>("ANONYMOUS");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    surveyWorkspaceAccess(careOnly, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setAccess(value);
      const preferred = initialAudience === "CLIENT" ? "CLIENT" : "DONOR";
      const other = preferred === "DONOR" ? "CLIENT" : "DONOR";
      setAudience(value[preferred].includes("view") ? preferred : value[other].includes("view") ? other : null);
    }, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [careOnly, initialAudience, retry]);

  useEffect(() => {
    if (!audience) return;
    const controller = new AbortController();
    setResult(null);
    setError("");
    surveyRequest<LibraryResult>(audience, `?audience=${audience}&page=${page}&q=${encodeURIComponent(query)}`, controller.signal)
      .then(setResult, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, page, query, retry]);

  useEffect(() => {
    if (!audience) return;
    const controller = new AbortController();
    setTemplates([]);
    surveyRequest<Template[]>(audience, `/templates?audience=${audience}`, controller.signal)
      .then(setTemplates, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, retry]);

  function createFrom(id = "") {
    const item = templates.find(row => row.id === id);
    setTitle(item?.definition.title ?? "");
    setTemplate(id);
    setIdentity("ANONYMOUS");
    setCreateError("");
    setOpen(true);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!audience || busy) return;
    setBusy(true);
    setCreateError("");
    try {
      const survey = await surveyWrite<SurveyCard>(audience, "", { audience, identity, title, templateId: template || undefined });
      router.push(surveyHref(survey.id, audience));
    } catch (reason) { setCreateError(message(reason)); setBusy(false); }
  }

  const canEdit = Boolean(audience && access?.[audience].includes("edit"));
  const available = (["DONOR", "CLIENT"] as const).filter(value => access?.[value].includes("view"));
  return <div className="survey-stack">
    <header className="survey-heading">
      <div className="survey-stack-tight"><p className="survey-eyebrow">Feedback studio</p><h1>Surveys</h1>
        <p className="survey-muted">Create questionnaires, invite people, and review their responses.</p></div>
      {canEdit && <button className="survey-btn survey-primary" onClick={() => createFrom()}><Plus size={18} /> Create survey</button>}
    </header>
    {available.length > 1 && <div className="survey-row" role="group" aria-label="Survey audience">
      {available.map(value => <button className="survey-btn" key={value} aria-pressed={audience === value} onClick={() => {
        setAudience(value); setPage(1); setQuery(""); setSearch("");
      }}>{audiences[value]}</button>)}
    </div>}
    {error && <div className="survey-rule survey-error survey-heading"><p role="alert">{error}</p>
      <button className="survey-btn" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {!access && !error && <p role="status">Checking survey access…</p>}
    {access && !available.length && <div className="survey-card survey-stack-tight"><h2>Survey access required</h2>
      <p className="survey-muted">Ask your administrator for access to donor surveys or a Compassion role with casework access.</p></div>}
    {audience && <div className="survey-stack">
      {canEdit && <section className="survey-hero">
        <div className="survey-row"><span className="survey-feature-icon"><LayoutTemplate size={23} aria-hidden /></span>
          <div className="survey-stack-tight"><h2>Start with a template</h2><p className="survey-muted">Adapt a questionnaire for {audiences[audience].toLowerCase()}.</p></div>
        </div>
        <div className="survey-row">{templates.slice(0, 2).map(item =>
          <button className="survey-btn" key={item.id} onClick={() => createFrom(item.id)}>{item.definition.title} <ArrowRight size={15} aria-hidden /></button>)}</div>
      </section>}
      <div className="survey-heading">
        <div className="survey-stack-tight"><h2>{audience === "DONOR" ? "Donor surveys" : "Client surveys"}</h2>
          {result && <p className="survey-caption">{result.total} {result.total === 1 ? "survey" : "surveys"}</p>}</div>
        <form className="survey-row" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}>
          <input className="survey-control" style={{ width: "auto", maxWidth: "100%" }} aria-label="Search surveys" type="search" maxLength={160}
            placeholder="Search by title" value={search} onChange={event => setSearch(event.currentTarget.value)} />
          <button className="survey-btn">Search</button>
        </form>
      </div>
      {!result && !error && <p role="status">Loading surveys…</p>}
      {result?.items.length === 0 && <div className="survey-card survey-stack">
        <ClipboardList size={25} aria-hidden /><h2>{query ? "No surveys match your search" : "Your survey library is empty"}</h2>
        <p className="survey-muted">{query ? "Try a different title." : "Start with a blank survey or choose a template."}</p>
        {canEdit && !query && <div><button className="survey-btn survey-primary" onClick={() => createFrom()}><FilePlus2 size={16} /> Create your first survey</button></div>}
      </div>}
      {result && <div className="survey-library">{result.items.map(row => <article className="survey-card survey-stack" key={row.id}>
        <div className="survey-row"><span className="survey-pill" data-status={row.status}>{statusLabels[row.status]}</span>
          <span className="survey-caption">{identities[row.identity]}</span></div>
        <div className="survey-stack-tight"><h2><Link className="survey-link" href={surveyHref(row.id, row.audience)}>{row.title}</Link></h2>
          <p className="survey-caption">Updated {formatDate(row.updatedAt, access!.timezone)}</p>
          {row.responseCount !== undefined && <p>{row.responseCount} {row.responseCount === 1 ? "response" : "responses"}</p>}</div>
        <div><Link className="survey-btn" href={surveyHref(row.id, row.audience)}>{row.status === "DRAFT" && canEdit ? "Continue building" : "Open survey"} <ArrowRight size={15} /></Link></div>
      </article>)}</div>}
      {result && result.total > 24 && <div className="survey-row">
        <button className="survey-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {Math.ceil(result.total / 24)}</span>
        <button className="survey-btn" disabled={page * 24 >= result.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </div>}
    {open && <SurveyDialog title="Create survey" onClose={() => { if (!busy) setOpen(false); }}>
      <form onSubmit={create} className="survey-stack">
        <p className="survey-caption">Audience · {audience && audiences[audience]}</p>
        <label className="survey-field">Start from<select value={template} onChange={event => {
          const id = event.currentTarget.value; setTemplate(id);
          setTitle(templates.find(row => row.id === id)?.definition.title ?? "");
        }}><option value="">Blank survey</option>
          {templates.map(row => <option key={row.id} value={row.id}>{row.definition.title}</option>)}</select></label>
        <label className="survey-field">Survey title<input required maxLength={160} value={title} onChange={event => setTitle(event.currentTarget.value)} /></label>
        <label className="survey-field">Response identity<select value={identity} onChange={event => setIdentity(event.currentTarget.value as Identity)}>
          <option value="ANONYMOUS">Anonymous</option><option value="LINKED">CRM-linked</option></select></label>
        <p className="survey-rule">{identity === "ANONYMOUS" ? "Share one link. Answers are not attached to individual records."
          : "Use personal links. Completed responses appear on the corresponding CRM record."}</p>
        {createError && <p role="alert" className="survey-rule survey-error">{createError}</p>}
        <div className="survey-row"><button className="survey-btn survey-primary" disabled={busy}>{busy ? "Creating…" : "Start building"}</button>
          <button type="button" className="survey-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </SurveyDialog>}
  </div>;
}
