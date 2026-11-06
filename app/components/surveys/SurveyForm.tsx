"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import { accentText, defaultAppearance, evaluateAnswers, type Answer, type Answers, type Definition, type Question } from "@/server/src/surveys/definition";
import { message, type Identity } from "./client";

function QuestionField({ question, value, set, error }: {
  question: Question; value?: Answer; set: (value: Answer | undefined) => void; error?: string;
}) {
  const id = useId();
  const label = <>{question.title}{question.required && <span className="survey-caption"> (required)</span>}</>;
  const errorId = error ? `${id}-error` : undefined;
  const attributes = { "aria-describedby": errorId, "aria-invalid": error ? true : undefined };
  const fieldError = error && <p id={errorId} className="survey-caption" role="alert">{error}</p>;
  if (question.type === "short" || question.type === "long" || question.type === "number") {
    return <div data-survey-question={question.id} className="survey-stack-tight">
      <label className="survey-field">{label}
        {question.type === "long"
          ? <textarea {...attributes} aria-required={question.required} value={typeof value === "string" ? value : ""} maxLength={2500}
            onChange={event => set(event.currentTarget.value)} />
          : <input {...attributes} aria-required={question.required} type={question.type === "number" ? "number" : "text"}
            step={question.type === "number" ? "any" : undefined} maxLength={question.type === "short" ? 250 : undefined}
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            onChange={event => set(question.type === "number" ? (event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber) : event.currentTarget.value)} />}
      </label>
      {fieldError}
    </div>;
  }
  const isScale = question.type === "rating" || question.type === "nps";
  const multi = question.type === "multiple";
  const options = question.type === "boolean" ? [{ label: "Yes", value: true }, { label: "No", value: false }]
    : question.type === "rating" ? Array.from({ length: 5 }, (_, index) => ({ label: String(index + 1), value: index + 1 }))
    : question.type === "nps" ? Array.from({ length: 11 }, (_, index) => ({ label: String(index), value: index }))
    : question.options.map(option => ({ label: option, value: option }));
  const selected = Array.isArray(value) ? value : [];
  return <fieldset data-survey-question={question.id} {...attributes}>
    <legend>{label}</legend>
    <div className={isScale ? "survey-scale" : "survey-stack-tight"}>
      {options.map((option, index) => <label key={index} className="survey-answer">
        <input name={id} type={multi ? "checkbox" : "radio"}
          checked={multi ? selected.includes(String(option.value)) : option.value === value}
          onChange={event => set(multi
            ? event.currentTarget.checked ? [...selected, String(option.value)] : selected.filter(item => item !== option.value)
            : option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
    {isScale && <div className="survey-heading survey-caption" style={{ marginTop: ".35rem" }}>
      <span>{question.type === "nps" ? "Not at all likely" : "Lowest"}</span>
      <span>{question.type === "nps" ? "Extremely likely" : "Highest"}</span>
    </div>}
    {fieldError}
  </fieldset>;
}

export default function SurveyForm({ definition, identity, organization, preview, completed, submit }: {
  definition: Definition; identity: Identity; organization?: string; preview?: boolean; completed?: boolean;
  submit?: (answers: Answers, key: string) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [sectionId, setSectionId] = useState(definition.sections[0]?.id);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(completed));
  const [error, setError] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wasNavigated = useRef(false);
  const evaluated = evaluateAnswers(definition, answers);
  const sections = definition.sections.filter(section => section.questions.some(question => evaluated.visible.has(question.id)));
  const index = Math.max(0, sections.findIndex(section => section.id === sectionId));
  const section = sections[index];
  const last = index >= sections.length - 1;
  useEffect(() => {
    if (wasNavigated.current) titleRef.current?.focus();
  }, [sectionId, done]);

  function move(id: string) {
    wasNavigated.current = true;
    setSectionId(id);
    setInvalid({});
    setError("");
  }

  async function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !section) return;
    const form = event.currentTarget;
    const bad = section.questions.find(question => evaluated.errors[question.id]);
    if (bad) {
      setInvalid(evaluated.errors);
      form.querySelector<HTMLElement>(`[data-survey-question="${bad.id}"] :is(input,textarea)`)?.focus();
      return;
    }
    if (!last) { move(sections[index + 1].id); return; }
    const earlier = sections.find(item => item.questions.some(question => evaluated.errors[question.id]));
    if (earlier) {
      move(earlier.id);
      setInvalid(evaluated.errors);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = JSON.stringify(evaluated.answers);
      if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
      await submit?.(evaluated.answers, attempt.current.key);
      wasNavigated.current = true;
      setDone(true);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  const theme = { ...defaultAppearance, ...definition.appearance };
  return <div className={`survey-respondent survey-stack${definition.appearance ? " survey-themed" : ""}`} style={definition.appearance ? { "--survey-blue": theme.accentColor, "--survey-on-accent": accentText(theme.accentColor), "--survey-controls": accentText(theme.accentColor) === "#000000" ? "#17485a" : theme.accentColor, background: theme.backgroundColor, fontFamily: theme.font === "serif" ? "Georgia,serif" : "Arial,sans-serif" } as CSSProperties : undefined}>
    <div className="survey-row"><span className="survey-feature-icon"><ClipboardList size={21} aria-hidden /></span>
      <div className="survey-stack-tight"><p className="survey-eyebrow">{preview ? "Respondent preview" : organization ?? "Survey"}</p>
        <p className="survey-caption">{preview ? "Preview answers stay in this tab." : "Your feedback"}</p></div>
    </div>
    <article className="survey-card survey-stack">
      {theme.logoUrl && <img className="survey-logo" src={theme.logoUrl} alt={theme.logoAlt} />}
      <div className="survey-stack-tight">
        <h1>{definition.title}</h1>
        {!done && definition.introduction && <p style={{ whiteSpace: "pre-wrap" }}>{definition.introduction}</p>}
        {!done && <p className="survey-caption">{identity === "ANONYMOUS"
          ? "Anonymous feedback. Your answers are not linked to a CRM record. Please avoid including identifying details."
          : "Your personal invitation links your answers to your record with the organization."}</p>}
      </div>
      {done ? <div className="survey-rule survey-stack-tight">
        <div className="survey-row"><CheckCircle2 size={22} aria-hidden /><h2 tabIndex={-1} ref={titleRef}>Response complete</h2></div>
        <p style={{ whiteSpace: "pre-wrap" }}>{definition.thanks}</p>
        {preview && <div><button className="survey-btn" onClick={() => {
          attempt.current = null; setAnswers({}); move(definition.sections[0].id); setDone(false);
        }}>Restart preview</button></div>}
      </div> : section ? <form className="survey-stack" onSubmit={next} noValidate>
        <div className="survey-stack-tight">
          <p className="survey-caption">Page {index + 1} of {sections.length}</p>
          <progress className="survey-bar" aria-label="Survey progress" max={sections.length} value={index + 1} />
          <h2 tabIndex={-1} ref={titleRef}>{section.title}</h2>
        </div>
        {section.questions.filter(question => evaluated.visible.has(question.id)).map(question =>
          <QuestionField key={question.id} question={question} value={answers[question.id]} error={invalid[question.id]}
            set={value => {
              setAnswers(previous => {
                const changed = { ...previous };
                if (value === undefined) delete changed[question.id]; else changed[question.id] = value;
                return changed;
              });
              setInvalid(previous => { const changed = { ...previous }; delete changed[question.id]; return changed; });
            }} />)}
        {error && <p role="alert" className="survey-rule survey-error">{error}</p>}
        <div className="survey-heading">
          {index > 0 && <button type="button" className="survey-btn" onClick={() => move(sections[index - 1].id)} disabled={busy}><ArrowLeft size={16} /> Back</button>}
          <button className="survey-btn survey-primary" disabled={busy}>{busy ? "Submitting…" : last ? (preview ? "Submit preview" : theme.buttonLabel) : "Next"} <ArrowRight size={16} /></button>
        </div>
      </form> : <p className="survey-muted">Add a visible question to preview this survey.</p>}
    </article>
  </div>;
}
