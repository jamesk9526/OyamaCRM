"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, Save } from "lucide-react";
import { parseDefinition, type Definition } from "@/server/src/surveys/definition";
import { audiences, formatDate, identities, localInput, localToIso, message, statusLabels, surveyHref, surveyRequest, surveyWrite,
  type Audience, type Identity, type SurveyCard, type SurveyDetail } from "./client";
import SurveyBuilder from "./SurveyBuilder";
import SurveyDialog from "./SurveyDialog";
import SurveyForm from "./SurveyForm";
import SurveyResponses from "./SurveyResponses";
import SurveyShare from "./SurveyShare";

type Step = "build" | "preview" | "share" | "responses";
const steps = { build: "Build", preview: "Preview & publish", share: "Share", responses: "Responses" };

export default function SurveyStudio({ id, audience, initialStep, initialResponse, initialRevision }: {
  id: string; audience: Audience; initialStep?: string; initialResponse?: string; initialRevision?: string;
}) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [draft, setDraft] = useState<Definition | null>(null);
  const [identity, setIdentity] = useState<Identity>("ANONYMOUS");
  const [step, setStep] = useState<Step>(initialStep === "share" || initialStep === "responses" || initialStep === "preview" ? initialStep : "build");
  const [closing, setClosing] = useState("");
  const [publishReview, setPublishReview] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = `/${encodeURIComponent(id)}`;
  const dirty = survey && draft && (JSON.stringify(survey.draft) !== JSON.stringify(draft) || identity !== survey.identity);

  function load(value: SurveyDetail) {
    setSurvey(value); setDraft(value.draft); setIdentity(value.identity);
    setClosing(value.closesAt ? localInput(value.closesAt, value.timezone) : "");
  }

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    surveyRequest<SurveyDetail>(audience, base, controller.signal).then(load, reason => {
      if (!controller.signal.aborted) setError(message(reason));
    });
    return () => controller.abort();
  }, [audience, base, retry]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function open(value: Step) {
    setStep(value); setError(""); setNotice("");
    const url = new URL(window.location.href);
    if (value === "build") url.searchParams.delete("view"); else url.searchParams.set("view", value);
    url.searchParams.delete("response");
    url.searchParams.delete("revision");
    window.history.replaceState(null, "", url);
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  async function save() {
    if (!survey || !draft) throw new Error("The survey is still loading.");
    if (!dirty) return survey.editVersion;
    const result = await surveyWrite<{ draft: Definition; editVersion: number }>(audience, base, {
      definition: draft, identity, editVersion: survey.editVersion,
    }, "PATCH");
    setDraft(result.draft);
    setSurvey({ ...survey, draft: result.draft, title: result.draft.title, identity, editVersion: result.editVersion, hasUnpublishedChanges: true });
    return result.editVersion;
  }

  async function publish() {
    if (!survey || !draft || busy) return;
    setBusy(true); setPublishError("");
    try {
      parseDefinition(draft, true);
      const closesAt = closing ? localToIso(closing, survey.timezone) : null;
      const editVersion = await save();
      const result = await surveyWrite<{ revision: number }>(audience, `${base}/publish`, { editVersion, closesAt });
      load(await surveyRequest<SurveyDetail>(audience, base));
      setPublishReview(false);
      open("share");
      setNotice(`Revision ${result.revision} is live. You can now share the survey.`);
    } catch (reason) { setPublishError(message(reason)); }
    finally { setBusy(false); }
  }

  if (!survey || !draft) return <div className="survey-card survey-stack">
    <h1>Survey studio</h1>
    {error ? <><p role="alert" className="survey-rule survey-error">{error}</p><div className="survey-row">
      <button className="survey-btn" onClick={() => setRetry(value => value + 1)}>Try again</button><Link className="survey-btn" href="/surveys">Survey library</Link>
    </div></> : <p role="status">Opening survey…</p>}
  </div>;

  const editable = survey.abilities.includes("edit") && (survey.status === "DRAFT" || survey.status === "LIVE");
  const canPublish = survey.abilities.includes("publish");
  let validation = "";
  if (step === "preview") {
    try { parseDefinition(draft, true); } catch (reason) { validation = message(reason); }
  }
  return <div className="survey-stack">
    <Link className="survey-link survey-row" href={`/surveys?audience=${survey.audience}`} onClick={event => {
      if (dirty && !window.confirm("Leave this survey without saving draft changes?")) event.preventDefault();
    }}><ArrowLeft size={16} aria-hidden /> Survey library</Link>
    <header className="survey-heading">
      <div className="survey-stack-tight">
        <p className="survey-eyebrow">{audiences[survey.audience]} · Guided studio</p>
        <h1>{draft.title || "Untitled survey"}</h1>
        <div className="survey-row">
          <span className="survey-pill" data-status={survey.status}>{statusLabels[survey.status]}</span>
          <span className="survey-caption">{identities[identity]}{survey.published ? ` · Revision ${survey.published}` : ""}
            {survey.closesAt ? ` · Closes ${formatDate(survey.closesAt, survey.timezone)}` : ""}</span>
        </div>
      </div>
      <div className="survey-row">
        {step === "build" && editable && <><button className="survey-btn" disabled={busy || !dirty} onClick={() => void run(async () => { await save(); setNotice("Draft saved."); })}><Save size={16} /> Save draft</button>
          <button className="survey-btn survey-primary" disabled={busy} onClick={() => open("preview")}>Preview survey <ArrowRight size={16} /></button></>}
        {step === "preview" && canPublish && (survey.status === "DRAFT" || survey.status === "LIVE") &&
          <button className="survey-btn survey-primary" disabled={busy || !!validation} onClick={() => { setPublishError(""); setPublishReview(true); }}>
            {survey.published && !dirty && !survey.hasUnpublishedChanges ? "Review closing date" : "Review publication"}
          </button>}
      </div>
    </header>
    <nav className="survey-steps" aria-label="Survey workflow">
      {(Object.entries(steps) as [Step, string][]).map(([value, label], index) =>
        <button type="button" className="survey-btn" key={value} disabled={busy} aria-current={step === value ? "step" : undefined}
          onClick={() => open(value)}>{index + 1}. {label}</button>)}
    </nav>
    {dirty && <p role="status" className="survey-caption">Unsaved draft changes</p>}
    {survey.status === "LIVE" && !dirty && survey.hasUnpublishedChanges && <p className="survey-rule">Saved draft changes are waiting to be published. Existing links still show their published revision.</p>}
    {error && <p role="alert" className="survey-rule survey-error">{error}</p>}
    {notice && <p role="status" className="survey-rule">{notice}</p>}
    {step === "build" && <SurveyBuilder definition={draft} setDefinition={setDraft} identity={identity} setIdentity={setIdentity}
      identityLocked={survey.published > 0} editable={editable} />}
    {step === "preview" && (validation ? <div className="survey-card survey-stack"><h2>Finish the draft to preview</h2><p role="alert">{validation}</p>
      <div><button className="survey-btn" onClick={() => open("build")}>Back to builder</button></div></div>
      : <SurveyForm key={JSON.stringify(draft)} definition={draft} identity={identity} preview />)}
    {step === "share" && <SurveyShare key={survey.published} survey={survey} />}
    {step === "responses" && <SurveyResponses key={survey.published} survey={survey} initialResponse={initialResponse} initialRevision={initialRevision} />}
    <details className="survey-card">
      <summary>Survey management</summary>
      <div className="survey-row" style={{ marginTop: ".7rem" }}>
        {survey.abilities.includes("edit") && <button className="survey-btn" disabled={busy} onClick={() => void run(async () => {
          if (dirty && !window.confirm("Duplicate the last saved draft? Unsaved changes will be left behind.")) return;
          const row = await surveyWrite<SurveyCard>(audience, `${base}/duplicate`); router.push(surveyHref(row.id, audience));
        })}>Duplicate survey</button>}
        {survey.abilities.includes("edit") && <button className="survey-btn" disabled={busy || !!dirty} onClick={() => void run(async () => {
          await surveyWrite(audience, `${base}/template`); setNotice("Saved as an organization template.");
        })}>Save as template</button>}
        {canPublish && survey.status === "LIVE" && <button className="survey-btn" disabled={busy || !!dirty} onClick={() => {
          if (window.confirm("Close this survey? New responses and pending emails will stop.")) void run(async () => {
            await surveyWrite(audience, `${base}/close`); load(await surveyRequest<SurveyDetail>(audience, base)); setNotice("Survey closed.");
          });
        }}>Close survey</button>}
        {canPublish && (survey.status === "DRAFT" || survey.status === "CLOSED") && <button className="survey-btn" disabled={busy || !!dirty} onClick={() => {
          if (window.confirm("Archive this survey? Responses and revisions will remain available.")) void run(async () => {
            await surveyWrite(audience, `${base}/archive`); load(await surveyRequest<SurveyDetail>(audience, base)); setNotice("Survey archived.");
          });
        }}>Archive survey</button>}
        {!survey.abilities.includes("edit") && !canPublish && <p className="survey-caption">You have view access to this survey.</p>}
      </div>
    </details>
    {publishReview && <SurveyDialog title="Review publication" onClose={() => { if (!busy) setPublishReview(false); }}>
      <div className="survey-stack">
        <div className="survey-rule survey-stack-tight"><div className="survey-row"><Eye size={17} aria-hidden /><h3>{draft.title}</h3></div>
          <p>{audiences[survey.audience]} · {identities[identity]} · {draft.sections.length} sections · {draft.sections.reduce((n, row) => n + row.questions.length, 0)} questions</p>
          <p className="survey-caption">{survey.published ? "Published links stay on their original revision. A closing date applies to every revision." :
            "Publishing locks the audience and response identity. Email is reviewed and sent from Share."}</p></div>
        <label className="survey-field">Optional closing date ({survey.timezone})<input type="datetime-local" value={closing}
          onChange={event => setClosing(event.currentTarget.value)} /></label>
        {publishError && <p role="alert" className="survey-rule survey-error">{publishError}</p>}
        <div className="survey-row"><button className="survey-btn survey-primary" disabled={busy} onClick={() => void publish()}>
          {busy ? "Publishing…" : survey.published && !dirty && !survey.hasUnpublishedChanges ? "Save closing date" : "Publish survey"}</button>
          <button className="survey-btn" disabled={busy} onClick={() => setPublishReview(false)}>Back to preview</button></div>
      </div>
    </SurveyDialog>}
  </div>;
}
