"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { message, surveyHref, surveyRequest, type Audience } from "./client";

type Row = { id: string; revisionId: string; revision: number; surveyId: string; title: string; submittedAt: string };

export default function SurveyRecordHistory({ audience, id }: { audience: Audience; id: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    surveyRequest<Row[]>(audience, `/records/${audience}/${encodeURIComponent(id)}/history`, controller.signal)
      .then(setRows, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, id, retry]);
  const recordPath = `${audience === "CLIENT" ? "/compassion/clients" : "/constituents"}/${encodeURIComponent(id)}`;
  return <div className="survey-stack">
    <Link className="survey-link survey-row" href={recordPath}><ArrowLeft size={16} aria-hidden /> Back to CRM record</Link>
    <div className="survey-heading"><div className="survey-stack-tight"><p className="survey-eyebrow">{audience === "CLIENT" ? "Client" : "Donor"} feedback</p>
      <h1>Survey history</h1><p className="survey-muted">Completed responses linked to this record.</p></div>
      <Link className="survey-btn" href={`/surveys?audience=${audience}`}>Open survey library <ArrowRight size={16} aria-hidden /></Link></div>
    {error && <div className="survey-rule survey-error survey-heading"><p role="alert">{error}</p><button className="survey-btn" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
    {!rows && !error && <p role="status">Loading survey history…</p>}
    {rows?.length === 0 && <section className="survey-card survey-stack-tight"><h2>No linked responses</h2>
      <p className="survey-muted">Completed personal invitations will appear here.</p></section>}
    {!!rows?.length && <section className="survey-card survey-stack">{rows.map(row => <article className="survey-heading survey-question-row" key={row.id}>
      <div className="survey-stack-tight"><h2>{row.title}</h2><p className="survey-caption">Revision {row.revision} · {new Date(row.submittedAt).toLocaleDateString()}</p></div>
      <Link className="survey-btn" href={surveyHref(row.surveyId, audience, { view: "responses", revision: row.revisionId, response: row.id })}>Read response</Link>
    </article>)}</section>}
  </div>;
}
