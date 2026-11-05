"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import type { Answer } from "@/server/src/surveys/definition";
import { downloadSurveyCsv, formatDate, localToIso, message, surveyRequest, type SurveyDetail } from "./client";
import SurveyDialog from "./SurveyDialog";

type Summary = { completed: number; invitationStats: { invited: number; completed: number; percentage: number | null } | null;
  questions: { id: string; title: string; type: string; answered: number; average: number | null; nps: number | null;
    distribution: { label: string; count: number; percentage: number }[] }[] };
type ResponseList = { total: number; items: { id: string; createdAt: string; name: string; contactId: string | null }[] };
type ResponseDetail = { id: string; createdAt: string; name: string; title: string; revision: number; contactId: string | null;
  answers: { id: string; title: string; value: Answer }[] };

function answerText(value: Answer) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default function SurveyResponses({ survey, initialResponse, initialRevision }: {
  survey: SurveyDetail; initialResponse?: string; initialRevision?: string;
}) {
  const base = `/${survey.id}`;
  const audience = survey.audience;
  const canRead = survey.abilities.includes("responses") && survey.published > 0;
  const [revision, setRevision] = useState(survey.revisions.find(row => row.id === initialRevision)?.id ?? survey.revisions[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>({});
  const [list, setList] = useState<ResponseList | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [responseId, setResponseId] = useState(initialResponse ?? "");
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ revision, ...dateFilter }).toString();

  useEffect(() => {
    if (!canRead || !revision) return;
    const controller = new AbortController();
    setSummary(null);
    surveyRequest<Summary>(audience, `${base}/summary?${query}`, controller.signal).then(setSummary, reason => {
      if (!controller.signal.aborted) setError(message(reason));
    });
    return () => controller.abort();
  }, [audience, base, canRead, query, revision, refresh]);

  useEffect(() => {
    if (!canRead || !revision) return;
    const controller = new AbortController();
    setList(null);
    surveyRequest<ResponseList>(audience, `${base}/responses?${query}&page=${page}`, controller.signal).then(setList, reason => {
      if (!controller.signal.aborted) setError(message(reason));
    });
    return () => controller.abort();
  }, [audience, base, canRead, page, query, refresh, revision]);

  useEffect(() => {
    if (!canRead || !responseId) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    surveyRequest<ResponseDetail>(audience, `${base}/responses/${encodeURIComponent(responseId)}`, controller.signal)
      .then(setDetail, reason => { if (!controller.signal.aborted) setDetailError(message(reason)); });
    return () => controller.abort();
  }, [audience, base, canRead, responseId]);

  if (!canRead) return <section className="survey-card survey-stack-tight"><h2>Responses</h2>
    <p className="survey-muted">{survey.published ? "Your role does not have access to survey responses." : "Publish and share this survey to start collecting responses."}</p></section>;

  return <div className="survey-stack">
    <section className="survey-card survey-stack">
      <div className="survey-heading"><div className="survey-stack-tight"><h2>Response overview</h2>
        <p className="survey-caption">Dates use {survey.timezone}.</p></div>
        <div className="survey-row">
          <button className="survey-btn" onClick={() => { setError(""); setRefresh(value => value + 1); }}><RefreshCw size={16} /> Refresh</button>
          {survey.abilities.includes("export") && <button className="survey-btn" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { await downloadSurveyCsv(audience, `${base}/export.csv?${query}`); } catch (reason) { setError(message(reason)); }
            finally { setBusy(false); }
          }}><Download size={16} /> {busy ? "Preparing…" : "Export CSV"}</button>}
        </div>
      </div>
      <form className="survey-row" style={{ alignItems: "end" }} onSubmit={event => {
        event.preventDefault(); setError("");
        try {
          const start = from ? localToIso(`${from}T00:00`, survey.timezone) : undefined;
          const nextDate = to ? new Date(Date.parse(`${to}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10) : "";
          const end = nextDate ? localToIso(`${nextDate}T00:00`, survey.timezone) : undefined;
          if (start && end && start >= end) throw new Error("Choose an end date on or after the start date.");
          setDateFilter({ ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) }); setPage(1);
        } catch (reason) { setError(message(reason)); }
      }}>
        <label className="survey-field">Revision<select value={revision} onChange={event => { setRevision(event.currentTarget.value); setPage(1); setError(""); }}>
          {survey.revisions.map(row => <option key={row.id} value={row.id}>Revision {row.number}</option>)}</select></label>
        <label className="survey-field">From<input type="date" value={from} onChange={event => setFrom(event.currentTarget.value)} /></label>
        <label className="survey-field">Through<input type="date" value={to} onChange={event => setTo(event.currentTarget.value)} /></label>
        <button className="survey-btn">Apply dates</button>
        {!!(dateFilter.from || dateFilter.to) && <button type="button" className="survey-btn" onClick={() => {
          setFrom(""); setTo(""); setDateFilter({}); setPage(1); setError("");
        }}>Clear dates</button>}
      </form>
      {error && <p role="alert" className="survey-rule survey-error">{error}</p>}
      {!summary && !error && <p role="status">Loading response summary…</p>}
      {summary && <div className="survey-row" style={{ gap: "2rem" }}>
        <div><p className="survey-metric">{summary.completed}</p><p className="survey-caption">Completed responses</p></div>
        {summary.invitationStats && <div><p className="survey-metric">{summary.invitationStats.percentage === null ? "—" : `${Math.round(summary.invitationStats.percentage)}%`}</p>
          <p className="survey-caption">Invitation completion · {summary.invitationStats.completed} of {summary.invitationStats.invited}</p></div>}
        {survey.identity === "ANONYMOUS" && <p className="survey-caption">Anonymous survey · No recipient completion tracking</p>}
      </div>}
    </section>
    {summary && summary.completed > 0 && <section className="survey-stack">
      <h2>Question summaries</h2>
      <div className="survey-grid">{summary.questions.map(question => <article className="survey-card survey-stack-tight" key={question.id}>
        <h3>{question.title}</h3><p className="survey-caption">{question.answered} answered{question.average !== null ? ` · Average ${question.average.toFixed(1)}` : ""}{question.nps !== null ? ` · NPS ${question.nps}` : ""}</p>
        {question.answered > 0 && question.distribution.map(item => <div className="survey-stack-tight" key={item.label}>
          <div className="survey-heading"><span>{item.label}</span><span>{item.count} · {Math.round(item.percentage)}%</span></div>
          <progress className="survey-bar" max={100} value={item.percentage} aria-label={`${item.label}: ${item.count} answers, ${Math.round(item.percentage)} percent`} />
        </div>)}
        {question.answered > 0 && question.type === "multiple" && <p className="survey-caption">Respondents may choose more than one answer.</p>}
        {question.answered > 0 && ["short", "long"].includes(question.type) && <p className="survey-caption">Read written answers under Individual responses.</p>}
      </article>)}</div>
    </section>}
    <section className="survey-card survey-stack">
      <h2>Individual responses</h2>
      {!list && !error && <p role="status">Loading responses…</p>}
      {list?.items.length === 0 && <p className="survey-muted">No completed responses for this revision and date range.</p>}
      {!!list?.items.length && <div className="survey-table-wrap">
        <table className="survey-table"><thead><tr><th>Respondent</th><th>Submitted</th><th>Response</th></tr></thead>
          <tbody>{list.items.map(row => <tr key={row.id}><td>{row.name}</td><td>{formatDate(row.createdAt, survey.timezone)}</td>
            <td><button className="survey-btn" onClick={() => setResponseId(row.id)}>Read response</button></td></tr>)}</tbody></table>
      </div>}
      {list && list.total > 25 && <div className="survey-row">
        <button className="survey-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(list.total / 25)}</span>
        <button className="survey-btn" disabled={page * 25 >= list.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </section>
    {responseId && <SurveyDialog title="Survey response" onClose={() => setResponseId("")}>
      {detailError && <p role="alert" className="survey-rule survey-error">{detailError}</p>}
      {!detail && !detailError && <p role="status">Loading response…</p>}
      {detail && <div className="survey-stack">
        <div className="survey-stack-tight"><h3>{detail.name}</h3><p className="survey-caption">{detail.title} · Revision {detail.revision} · {formatDate(detail.createdAt, survey.timezone)}</p>
          {detail.contactId && <Link className="survey-link" href={`${survey.audience === "CLIENT" ? "/compassion/clients" : "/constituents"}/${detail.contactId}`}>Open CRM record</Link>}</div>
        {!detail.answers.length && <p className="survey-muted">This response contains no answers to optional questions.</p>}
        <dl className="survey-definition-list">{detail.answers.map(row => <div key={row.id}><dt>{row.title}</dt><dd>{answerText(row.value)}</dd></div>)}</dl>
      </div>}
    </SurveyDialog>}
  </div>;
}
