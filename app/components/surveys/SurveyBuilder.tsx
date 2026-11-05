"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus, Settings2, Trash2 } from "lucide-react";
import { allowedOperators, questionTypes, type Definition, type Question, type QuestionType, type Rule } from "@/server/src/surveys/definition";
import { type Identity } from "./client";
import SurveyDialog from "./SurveyDialog";

const operatorLabels = { is: "is", contains: "includes", atMost: "is at most", atLeast: "is at least" } as const;
const choices = (type: QuestionType) => type === "single" || type === "multiple";

function moved<T>(items: T[], index: number, offset: number) {
  const copy = items.slice();
  const target = index + offset;
  if (target < 0 || target >= items.length) return copy;
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function defaultRule(source: Question): Rule {
  return { questionId: source.id, operator: allowedOperators(source.type)[0],
    value: source.type === "boolean" ? true : choices(source.type) ? source.options[0] ?? "" : source.type === "rating" ? 1 : 0 };
}

function QuestionEditor({ question, earlier, onSave, onClose }: {
  question: Question; earlier: Question[]; onSave: (question: Question) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(question);
  const [optionText, setOptions] = useState(question.options.join("\n"));
  const candidates = earlier.filter(item => allowedOperators(item.type).length);
  const condition = value.rule;
  const source = candidates.find(item => item.id === condition?.questionId);
  function patch(change: Partial<Question>) { setValue(previous => ({ ...previous, ...change })); }
  return <SurveyDialog title="Question settings" onClose={onClose}>
    <form className="survey-stack" onSubmit={event => {
      event.preventDefault();
      onSave({ ...value, options: choices(value.type) ? optionText.split("\n").map(option => option.trim()).filter(Boolean) : [] });
    }}>
      <label className="survey-field">Question text<input required value={value.title} maxLength={300} onChange={event => patch({ title: event.currentTarget.value })} /></label>
      <label className="survey-field">Question type<select value={value.type} onChange={event => {
        const type = event.currentTarget.value as QuestionType;
        if (choices(type) && !optionText) setOptions("Option 1\nOption 2");
        patch({ type });
      }}>{Object.entries(questionTypes).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
      {choices(value.type) && <label className="survey-field">Choices (one per line)
        <textarea required value={optionText} onChange={event => setOptions(event.currentTarget.value)} maxLength={2420} /></label>}
      <label className="survey-row"><input type="checkbox" checked={value.required} onChange={event => patch({ required: event.currentTarget.checked })} /> Required when shown</label>
      <section className="survey-rule survey-stack">
        <div className="survey-row"><GitBranch size={17} aria-hidden /><h3>Conditional display</h3></div>
        <label className="survey-field">Show this question<select value={condition?.questionId ?? ""}
          onChange={event => { const item = candidates.find(entry => entry.id === event.currentTarget.value); patch({ rule: item ? defaultRule(item) : undefined }); }}>
          <option value="">Always</option>
          {condition && !source && <option value={condition.questionId}>Unavailable earlier question</option>}
          {candidates.map(item => <option key={item.id} value={item.id}>When “{item.title || "Untitled question"}”</option>)}
        </select></label>
        {condition && source && <div className="survey-grid">
          <label className="survey-field">Comparison<select value={condition.operator} onChange={event => patch({ rule: { ...condition, operator: event.currentTarget.value as Rule["operator"] } })}>
            {allowedOperators(source.type).map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select></label>
          <label className="survey-field">Answer
            {source.type === "boolean" ? <select value={String(condition.value)} onChange={event => patch({ rule: { ...condition, value: event.currentTarget.value === "true" } })}>
              <option value="true">Yes</option><option value="false">No</option></select>
              : choices(source.type) ? <select value={String(condition.value)} onChange={event => patch({ rule: { ...condition, value: event.currentTarget.value } })}>
                {!source.options.includes(String(condition.value)) && <option value={String(condition.value)}>Choose an available option</option>}
                {source.options.map((option, index) => <option key={index}>{option}</option>)}</select>
              : <input type="number" required value={typeof condition.value === "number" && Number.isFinite(condition.value) ? condition.value : ""}
                min={source.type === "rating" ? 1 : source.type === "nps" ? 0 : -1e12} max={source.type === "rating" ? 5 : source.type === "nps" ? 10 : 1e12}
                step={source.type === "number" ? "any" : 1}
                onChange={event => patch({ rule: { ...condition, value: event.currentTarget.valueAsNumber } })} />}
          </label>
        </div>}
        {condition && !source && <p className="survey-caption">Choose a different question or select Always to clear this condition.</p>}
        {!condition && !candidates.length && <p className="survey-caption">Add an earlier choice, rating, yes/no, or number question to use a condition.</p>}
      </section>
      <div className="survey-row"><button className="survey-btn survey-primary">Apply question</button>
        <button type="button" className="survey-btn" onClick={onClose}>Cancel</button></div>
    </form>
  </SurveyDialog>;
}

export default function SurveyBuilder({ definition, setDefinition, identity, setIdentity, identityLocked, editable }: {
  definition: Definition; setDefinition: (value: Definition) => void; identity: Identity; setIdentity: (value: Identity) => void;
  identityLocked: boolean; editable: boolean;
}) {
  const [editor, setEditor] = useState<{ sectionId: string; question: Question; isNew: boolean } | null>(null);
  const allQuestions = definition.sections.flatMap(section => section.questions);
  const change = (patch: Partial<Definition>) => setDefinition({ ...definition, ...patch });
  const changeSection = (id: string, patch: Partial<Definition["sections"][number]>) =>
    change({ sections: definition.sections.map(section => section.id === id ? { ...section, ...patch } : section) });
  const section = editor && definition.sections.find(item => item.id === editor.sectionId);
  const precedingSections = section ? definition.sections.slice(0, definition.sections.indexOf(section)) : [];
  const earlier = section && editor ? [...precedingSections.flatMap(item => item.questions),
    ...section.questions.slice(0, editor.isNew ? section.questions.length : section.questions.findIndex(item => item.id === editor.question.id))] : [];
  return <div className="survey-grid">
    <section className="survey-card survey-stack">
      <h2>Survey setup</h2>
      <label className="survey-field">Title<input value={definition.title} maxLength={160} readOnly={!editable} onChange={event => change({ title: event.currentTarget.value })} /></label>
      <label className="survey-field">Introduction<textarea value={definition.introduction} maxLength={2000} readOnly={!editable}
        onChange={event => change({ introduction: event.currentTarget.value })} /></label>
      <label className="survey-field">Thank-you message<textarea value={definition.thanks} maxLength={1000} readOnly={!editable}
        onChange={event => change({ thanks: event.currentTarget.value })} /></label>
      <label className="survey-field">Response identity<select value={identity} disabled={!editable || identityLocked}
        onChange={event => setIdentity(event.currentTarget.value as Identity)}><option value="ANONYMOUS">Anonymous</option>
        <option value="LINKED">CRM-linked</option></select></label>
      <p className="survey-caption">{identityLocked ? "Identity is fixed after the first publication." : "Choose the identity policy before publishing."}</p>
    </section>
    <section className="survey-card survey-stack">
      <div className="survey-heading"><div className="survey-stack-tight"><h2>Sections and questions</h2>
        <p className="survey-caption">Each section is a page in the respondent form.</p></div>
        {editable && <button className="survey-btn" disabled={definition.sections.length >= 12} onClick={() => change({ sections: [
          ...definition.sections, { id: crypto.randomUUID(), title: `Section ${definition.sections.length + 1}`, questions: [] },
        ] })}><Plus size={16} /> Section</button>}
      </div>
      {definition.sections.map((item, index) => <section key={item.id} className="survey-builder-section survey-stack">
        <div className="survey-heading">
          <label className="survey-field" style={{ flex: "1 1 11rem" }}>Section {index + 1} title<input value={item.title} maxLength={160} readOnly={!editable}
            onChange={event => changeSection(item.id, { title: event.currentTarget.value })} /></label>
          {editable && <div className="survey-row">
            <button className="survey-btn" aria-label={`Move section ${index + 1} up`} disabled={!index} onClick={() => change({ sections: moved(definition.sections, index, -1) })}><ArrowUp size={16} /></button>
            <button className="survey-btn" aria-label={`Move section ${index + 1} down`} disabled={index === definition.sections.length - 1}
              onClick={() => change({ sections: moved(definition.sections, index, 1) })}><ArrowDown size={16} /></button>
            <button className="survey-btn" aria-label={`Remove section ${index + 1}`} onClick={() => {
              if (!item.questions.length || window.confirm("Remove this section and all of its questions from the draft?")) {
                change({ sections: definition.sections.filter(row => row.id !== item.id) });
              }
            }}><Trash2 size={16} /></button>
          </div>}
        </div>
        {!item.questions.length && <p className="survey-caption">Add a question to this section.</p>}
        {item.questions.map((question, position) => <div className="survey-question-row survey-heading" key={question.id}>
          <div className="survey-stack-tight"><h3>{position + 1}. {question.title || "Untitled question"}</h3>
            <p className="survey-caption">{questionTypes[question.type]}{question.required ? " · Required" : ""}{question.rule ? " · Conditional" : ""}</p></div>
          {editable && <div className="survey-row">
            <button className="survey-btn" aria-label={`Edit ${question.title}`} onClick={() => setEditor({ sectionId: item.id, question, isNew: false })}><Settings2 size={16} /></button>
            <button className="survey-btn" aria-label={`Move question ${position + 1} up`} disabled={!position}
              onClick={() => changeSection(item.id, { questions: moved(item.questions, position, -1) })}><ArrowUp size={16} /></button>
            <button className="survey-btn" aria-label={`Move question ${position + 1} down`} disabled={position === item.questions.length - 1}
              onClick={() => changeSection(item.id, { questions: moved(item.questions, position, 1) })}><ArrowDown size={16} /></button>
            <button className="survey-btn" aria-label={`Remove ${question.title}`}
              onClick={() => changeSection(item.id, { questions: item.questions.filter(row => row.id !== question.id) })}><Trash2 size={16} /></button>
          </div>}
        </div>)}
        {editable && <div><button className="survey-btn" disabled={item.questions.length >= 40 || allQuestions.length >= 60}
          onClick={() => setEditor({ sectionId: item.id, isNew: true, question: { id: crypto.randomUUID(), type: "short", title: "", options: [], required: false } })}>
          <Plus size={17} /> Add question</button></div>}
      </section>)}
    </section>
    {editor && section && <QuestionEditor question={editor.question} earlier={earlier} onClose={() => setEditor(null)}
      onSave={question => {
        changeSection(section.id, { questions: editor.isNew ? [...section.questions, question] : section.questions.map(item => item.id === question.id ? question : item) });
        setEditor(null);
      }} />}
  </div>;
}
