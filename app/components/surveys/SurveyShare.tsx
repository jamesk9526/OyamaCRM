"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Mail, Search } from "lucide-react";
import { formatDate, identities, localToIso, message, surveyRequest, surveyWrite, type SurveyDetail } from "./client";
import { renderSurveyEmail, type EmailDesign } from "@/server/src/surveys/email";
import type { Definition } from "@/server/src/surveys/definition";
import SurveyDialog from "./SurveyDialog";

type Contact = { id: string; name: string; email: string };
type List = { id: string; name: string; _count?: { recipients: number } };
type DraftDistribution = { allContacts: boolean; emailDesign?: EmailDesign; subject: string; message: string; sendAt: string | null; reminderDays: number | null; contactIds: string[]; listIds: string[] };
type Review = { rows: (Contact & { excluded: string | null })[]; ready: number; missing: number; unlinkedEntries: number;
  sender: string | null; subject: string; message: string; scheduledAt: string | null; closesAt: string | null;
  reminderDays: number | null; emailDesign?: EmailDesign; revision: { number: number; definition?: Definition }; reviewHash: string };
type Batch = { id: string; revision: number; subject: string; sendAt: string; recipients: number; reminderDays: number | null; counts: Record<string, number> };
type Invitation = { id: string; name: string; expiresAt: string; revokedAt: string | null; completedAt: string | null;
  revision: { number: number }; jobs: { status: string; reminder: boolean; outcome: string | null }[] };

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const absolute = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return <div className="survey-stack-tight">
    <label className="survey-field">Survey link<input value={absolute} readOnly onFocus={event => event.currentTarget.select()} /></label>
    <div className="survey-row">
      <button className="survey-btn" type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(absolute); setCopied(true); setError(""); }
        catch { setError("Select the link and copy it manually."); }
      }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy link"}</button>
      <a className="survey-link" href={absolute} target="_blank" rel="noreferrer">Open form</a>
    </div>
    {error && <p role="alert" className="survey-caption">{error}</p>}
  </div>;
}

export default function SurveyShare({ survey }: { survey: SurveyDetail }) {
  const base = `/${survey.id}`;
  const audience = survey.audience;
  const isLinked = survey.identity === "LINKED";
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selected, setSelected] = useState<Contact[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [listIds, setListIds] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState(false);
  const [emailDesign, setEmailDesign] = useState<EmailDesign>({ heading: survey.title, buttonLabel: "Take the survey", signature: "Thank you for sharing your feedback." });
  const [subject, setSubject] = useState("Share your feedback");
  const [body, setBody] = useState("We would appreciate your feedback. Please use the link below to complete a short survey.");
  const [schedule, setSchedule] = useState("");
  const [reminder, setReminder] = useState(false);
  const [days, setDays] = useState("7");
  const [personal, setPersonal] = useState<{ path: string; name: string } | null>(null);
  const [reviewed, setReviewed] = useState<{ review: Review; input: DraftDistribution; requestKey: string } | null>(null);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [notice, setNotice] = useState("");
  const [linkRevision, setLinkRevision] = useState(survey.revisions[0]?.id ?? "");
  const path = survey.revisions.find(row => row.id === linkRevision)?.path;
  const canShare = survey.status === "LIVE" && survey.abilities.includes("send");

  useEffect(() => {
    if (!canShare) return;
    const controller = new AbortController();
    setContacts(null);
    surveyRequest<Contact[]>(audience, `${base}/contacts?q=${encodeURIComponent(query)}`, controller.signal)
      .then(setContacts, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, base, query, canShare, refresh]);

  useEffect(() => {
    if (!canShare || survey.audience !== "DONOR") return;
    const controller = new AbortController();
    surveyRequest<List[]>(audience, `${base}/lists`, controller.signal)
      .then(setLists, reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, base, canShare, survey.audience, refresh]);

  useEffect(() => {
    if (!survey.published || !survey.abilities.includes("send")) return;
    const controller = new AbortController();
    Promise.all([surveyRequest<Batch[]>(audience, `${base}/distributions`, controller.signal),
      isLinked ? surveyRequest<Invitation[]>(audience, `${base}/invitations`, controller.signal) : Promise.resolve([])])
      .then(([rows, inviteRows]) => { setBatches(rows); setInvitations(inviteRows); },
        reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [audience, base, isLinked, refresh, survey.abilities, survey.published]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  function preview(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      const input: DraftDistribution = { allContacts, ...(audience === "DONOR" ? { emailDesign } : {}), subject, message: body, contactIds: selected.map(contact => contact.id), listIds,
        sendAt: schedule ? localToIso(schedule, survey.timezone) : null, reminderDays: reminder ? Number(days) : null };
      const review = await surveyWrite<Review>(audience, `${base}/distributions/review`, input);
      setReviewError("");
      setReviewed({ review, input, requestKey: crypto.randomUUID() });
    });
  }

  async function send() {
    if (!reviewed || busy) return;
    setBusy(true); setReviewError("");
    try {
      await surveyWrite(audience, `${base}/distributions`, { ...reviewed.input, reviewHash: reviewed.review.reviewHash, requestKey: reviewed.requestKey });
      setReviewed(null);
      setSelected([]);
      setListIds([]); setAllContacts(false);
      setNotice("Distribution queued. Check delivery history for progress.");
      setRefresh(value => value + 1);
    } catch (reason) { setReviewError(message(reason)); }
    finally { setBusy(false); }
  }

  return <div className="survey-stack">
    {error && <div className="survey-heading survey-rule survey-error"><p role="alert">{error}</p>
      <button className="survey-btn" onClick={() => { setError(""); setRefresh(value => value + 1); }}>Refresh</button></div>}
    {notice && <p role="status" className="survey-rule">{notice}</p>}
    {!canShare && <div className="survey-card survey-stack-tight"><h2>{survey.published ? "Distribution history" : "Publish to start sharing"}</h2>
      <p className="survey-muted">{survey.status === "CLOSED" || survey.status === "ARCHIVED" ? "This survey is closed to new invitations." :
        survey.published ? "Your role does not have permission to distribute this survey." : "Review the respondent preview and publish a revision first."}</p></div>}
    {canShare && <>
      <div className="survey-grid">
        <section className="survey-card survey-stack">
          <div className="survey-row"><Link2 size={20} aria-hidden /><h2>{isLinked ? "Personal invitation links" : "Shared survey link"}</h2></div>
          <p className="survey-muted">{isLinked ? "Create a private link for a selected record. Share it only through an approved channel." :
            "Everyone gets the same link. Answers are stored without a CRM record or person-level completion tracking."}</p>
          {!isLinked && survey.revisions.length > 1 && <label className="survey-field">Published revision
            <select value={linkRevision} onChange={event => setLinkRevision(event.currentTarget.value)}>{survey.revisions.map(item =>
              <option key={item.id} value={item.id}>Revision {item.number}</option>)}</select></label>}
          {!isLinked && path && <CopyLink key={path} path={path} />}
          {isLinked && personal && <div className="survey-rule survey-stack-tight"><h3>Link for {personal.name}</h3><CopyLink key={personal.path} path={personal.path} /></div>}
          {isLinked && !personal && <p className="survey-caption">Find a recipient below to generate their link.</p>}
        </section>
        <section className="survey-card survey-stack">
          <h2>Recipients</h2>
          <form className="survey-row" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}>
            <input type="search" className="survey-control" aria-label="Find recipients" style={{ flex: "1 1 10rem" }} value={search}
              maxLength={100} placeholder="Find by name or email" onChange={event => setSearch(event.currentTarget.value)} />
            <button className="survey-btn"><Search size={16} /> Find</button>
          </form>
          {audience === "DONOR" && <label className="survey-row survey-rule"><input type="checkbox" checked={allContacts} onChange={event => setAllContacts(event.currentTarget.checked)} />All open donor records with eligible email</label>}
          <p className="survey-caption">{allContacts ? "Full donor audience selected" : `${selected.length} contacts selected for email`}. Review resolves entire selected lists, removes duplicates and checks survey preferences. Up to 10,000 recipients per distribution.</p>
          {selected.length > 0 && <div className="survey-row">{selected.map(contact => <button type="button" className="survey-btn" key={contact.id}
            onClick={() => setSelected(values => values.filter(value => value.id !== contact.id))}>Remove {contact.name}</button>)}</div>}
          {!contacts && !error && <p role="status">Loading contacts…</p>}
          {contacts?.length === 0 && <p className="survey-muted">No matching records.</p>}
          {contacts && contacts.length > 0 && <div className="survey-choice-list survey-stack-tight">
            {contacts.map(contact => <div className="survey-heading survey-question-row" key={contact.id}>
              <label className="survey-row"><input type="checkbox" checked={selected.some(item => item.id === contact.id)}
                disabled={selected.length >= 500 && !selected.some(item => item.id === contact.id)}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  setSelected(values => checked ? [...values, contact] : values.filter(value => value.id !== contact.id));
                }} /><span>{contact.name}<br /><span className="survey-caption">{contact.email || "No email address"}</span></span></label>
              {isLinked && <button className="survey-btn" disabled={busy} aria-label={`Create personal link for ${contact.name}`} onClick={() => void run(async () => {
                const link = await surveyWrite<{ path: string }>(audience, `${base}/personal-link`, { contactId: contact.id });
                setPersonal({ ...link, name: contact.name }); setRefresh(value => value + 1);
              })}>Personal link</button>}
            </div>)}
          </div>}
          {!!lists.length && <fieldset><legend>Full audience lists</legend><div className="survey-choice-list survey-stack-tight">
            {lists.map(list => <label className="survey-row" key={list.id}><input type="checkbox" checked={listIds.includes(list.id)}
              disabled={listIds.length >= 10 && !listIds.includes(list.id)} onChange={event => {
                const checked = event.currentTarget.checked;
                setListIds(values => checked ? [...values, list.id] : values.filter(value => value !== list.id));
              }} />{list.name}{list._count ? ` · ${list._count.recipients.toLocaleString()} entries` : ""}</label>)}
          </div></fieldset>}
        </section>
      </div>
      <section className="survey-card survey-stack">
        <div className="survey-row"><Mail size={20} aria-hidden /><h2>Email invitations</h2></div>
        <p className="survey-muted">{survey.audience === "CLIENT"
          ? "Only clients with safe email contact enabled are eligible. Keep the subject and message free of private details."
          : "Contact preferences and suppressions are checked before each delivery."}</p>
        <form className="survey-stack" onSubmit={preview}>
          <label className="survey-field">Subject<input required value={subject} maxLength={160} onChange={event => setSubject(event.currentTarget.value)} /></label>
          {audience === "DONOR" && <label className="survey-field">Email heading<input value={emailDesign.heading} maxLength={160} onChange={event => setEmailDesign({ ...emailDesign, heading: event.currentTarget.value })} /></label>}
          <label className="survey-field">Message<textarea required value={body} maxLength={3000} onChange={event => setBody(event.currentTarget.value)} /></label>
          {audience === "DONOR" && <>
            <p className="survey-caption">Personalize with {"{{name}}"} and {"{{survey_link}}"}. A survey button and survey-only unsubscribe link are always included.</p>
            <label className="survey-field">Survey button text<input required value={emailDesign.buttonLabel} maxLength={80} onChange={event => setEmailDesign({ ...emailDesign, buttonLabel: event.currentTarget.value })} /></label>
            <label className="survey-field">Email signature<textarea value={emailDesign.signature} maxLength={1000} onChange={event => setEmailDesign({ ...emailDesign, signature: event.currentTarget.value })} /></label>
            <details><summary>Preview invitation email</summary><p className="survey-caption">Sample recipient. The review uses the published survey logo and colors.</p>
              <div className="survey-email-preview" onClick={event => event.preventDefault()} dangerouslySetInnerHTML={{ __html: renderSurveyEmail({ message: body, design: { ...emailDesign, buttonLabel: emailDesign.buttonLabel || "Open survey" }, appearance: survey.draft.appearance, name: "Sample donor", origin: "https://preview.invalid", surveyUrl: "https://preview.invalid/s/respond", preferences: [{ label: "Unsubscribe from surveys", href: "#survey-preferences" }] }).html }} />
            </details>
          </>}
          <div className="survey-grid">
            <label className="survey-field">Schedule ({survey.timezone})<input type="datetime-local" value={schedule} onChange={event => setSchedule(event.currentTarget.value)} />
              <span className="survey-caption">Leave blank to send after review.</span></label>
            <div className="survey-stack-tight">
              <label className="survey-row"><input type="checkbox" checked={reminder} onChange={event => setReminder(event.currentTarget.checked)} /> Send one reminder</label>
              {reminder && <label className="survey-field">Days after the scheduled send<input type="number" min={1} max={30} required value={days}
                onChange={event => setDays(event.currentTarget.value)} /></label>}
              <p className="survey-caption">{isLinked ? "Reminder recipients are limited to people who have not responded." :
                "All recipients of the original email get the reminder, including people who already responded."}</p>
            </div>
          </div>
          <div><button className="survey-btn survey-primary" disabled={busy || (!selected.length && !listIds.length && !allContacts)}>{busy ? "Checking recipients…" : "Review invitations"}</button></div>
        </form>
      </section>
    </>}
    {survey.published > 0 && survey.abilities.includes("send") && <section className="survey-card survey-stack">
      <div className="survey-heading"><h2>Delivery history</h2><button className="survey-btn" onClick={() => setRefresh(value => value + 1)}>Refresh history</button></div>
      {batches === null && !error && <p role="status">Loading delivery history…</p>}
      {batches?.length === 0 && <p className="survey-muted">No invitations have been queued.</p>}
      {batches?.map(batch => <article className="survey-question-row survey-stack-tight" key={batch.id}>
        <h3>{batch.subject}</h3><p className="survey-caption">Revision {batch.revision} · {formatDate(batch.sendAt, survey.timezone)} · {batch.recipients} recipients{batch.reminderDays ? ` · Reminder after ${batch.reminderDays} days` : ""}</p>
        <div className="survey-row">{Object.entries(batch.counts).map(([status, count]) => <span className="survey-pill" key={status}>{count} {status.toLowerCase()}</span>)}</div>
        {Boolean(batch.counts.FAILED || batch.counts.UNKNOWN) && <p className="survey-muted">Check email setup or provider delivery history. Unknown attempts may have reached the recipient.</p>}
      </article>)}
    </section>}
    {!!invitations?.length && <section className="survey-card survey-stack">
      <h2>Personal invitations</h2>
      <div className="survey-table-wrap"><table className="survey-table"><thead><tr><th>Recipient</th><th>Revision</th><th>Link status</th><th>Actions</th></tr></thead>
        <tbody>{invitations.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.revision.number}</td><td>
          {row.revokedAt ? "Revoked" : row.completedAt ? "Completed" : new Date(row.expiresAt) <= new Date() ? "Expired" : `Expires ${formatDate(row.expiresAt, survey.timezone)}`}
          {row.jobs.map(job => <p className="survey-caption" key={String(job.reminder)}>{job.reminder ? "Reminder" : "Invitation"} · {job.status.toLowerCase()}{job.outcome ? ` · ${job.outcome}` : ""}</p>)}
        </td><td>{canShare && !row.revokedAt && !row.completedAt && <button className="survey-btn" disabled={busy} onClick={() => {
          if (window.confirm(`Revoke the link for ${row.name}?`)) void run(async () => {
            await surveyWrite(audience, `${base}/invitations/${row.id}/revoke`); setPersonal(null); setRefresh(value => value + 1); setNotice("Invitation revoked.");
          });
        }}>Revoke</button>}</td></tr>)}</tbody></table></div>
    </section>}
    {reviewed && <SurveyDialog title="Review distribution" onClose={() => { if (!busy) setReviewed(null); }}>
      <div className="survey-stack">
        <div className="survey-rule survey-stack-tight">
          <p><strong>{reviewed.review.ready} eligible</strong> · Revision {reviewed.review.revision.number} · {identities[survey.identity]}</p>
          <p>Sender · {reviewed.review.sender ?? "Email provider is not configured"}</p>
          <p>Send · {reviewed.review.scheduledAt ? formatDate(reviewed.review.scheduledAt, survey.timezone) : "After confirmation"}</p>
          <p>Closes · {reviewed.review.closesAt ? formatDate(reviewed.review.closesAt, survey.timezone) : "When manually closed"}</p>
          <p>Reminder · {reviewed.review.reminderDays ? `After ${reviewed.review.reminderDays} days · ${isLinked ? "nonrespondents" : "all original recipients"}` : "Off"}</p>
        </div>
        <div className="survey-stack-tight"><h3>{reviewed.review.subject}</h3>
          {audience === "DONOR" ? <div className="survey-email-preview" onClick={event => event.preventDefault()} dangerouslySetInnerHTML={{ __html: renderSurveyEmail({ message: reviewed.review.message, design: reviewed.review.emailDesign, appearance: reviewed.review.revision.definition?.appearance, name: "Sample donor", origin: "https://preview.invalid", surveyUrl: "https://preview.invalid/s/respond", preferences: [{ label: "Unsubscribe from surveys", href: "#survey-preferences" }] }).html }} /> : <p style={{ whiteSpace: "pre-wrap" }}>{reviewed.review.message}</p>}
          <p className="survey-caption">Each recipient gets the survey link. Survey opt-outs change survey invitations only.</p></div>
        {reviewed.review.missing > 0 && <p className="survey-caption">{reviewed.review.missing} unavailable CRM records excluded.</p>}
        {reviewed.review.unlinkedEntries > 0 && <p className="survey-caption">{reviewed.review.unlinkedEntries} list entries without a CRM record excluded.</p>}
        <div className="survey-choice-list survey-stack-tight">
          {reviewed.review.rows.map(row => <p key={row.id} className="survey-question-row">{row.name} · {row.email || "No email"}<br />
            <span className="survey-caption">{row.excluded || "Eligible"}</span></p>)}
        </div>
        {reviewError && <p role="alert" className="survey-rule survey-error">{reviewError}</p>}
        <div className="survey-row"><button className="survey-btn survey-primary" disabled={busy || !reviewed.review.ready || !reviewed.review.sender}
          onClick={() => void send()}>{busy ? "Queuing…" : "Confirm and queue"}</button>
          <button className="survey-btn" disabled={busy} onClick={() => setReviewed(null)}>Back to edit</button></div>
      </div>
    </SurveyDialog>}
  </div>;
}
