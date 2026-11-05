"use client";
/* eslint-disable @next/next/no-img-element */
import { CASE_INTRO, FORM_TEMPLATES, type Answers, type PaperField } from "@/server/src/compassion/form-templates";

// Row groups preserve the side-by-side fields and follow-up lines on the supplied paper.
const groups: Record<string, string[][]> = {
  "Basic Information": [["firstName","lastName","middleInitial"],["dateOfBirth","age"],["mailingAddress"],["city","state","zip"],["phone","phonePermission"],["email","emailPermission"],["maritalStatus"],["incomeLevel"],["ethnicity","ethnicityOther"],["primaryLanguage","languageOther"]],
  "Support System": [["supportPeople","supportOther"],["outsideHelp"]],
  "Symptoms you’re currently experiencing (check all that apply):": [["symptoms","symptomsOther"]],
  "Current Needs & Goals": [["needs","needsOther"]],
  "Birth Control & Pregnancy Intentions": [["birthControl","birthControlOther"],["hopedPregnancy"],["pregnancyThoughts"]],
  "Family & Household": [["household","householdOther"],["livingSafe"],["stableHousing"]],
  "Partner Information": [["partnerName","partnerAge"],["partnerInvolved"],["partnerKnows"],["partnerRelationship"]],
  "GYN/Medical history:": [["tubalLigation","ectopicPregnancy"],["iud"],["stdTested"],["std","stdList"],["latexAllergy"],["allergies","allergiesList"],["medications","medicationsList"],["endingMedication"],["endingMedicationList"]],
  "Lifestyle & Health": [["substances","substancesList"],["smoking","vaping"],["illness","illnessList"],["pain","painScale"],["bleeding"]],
  "Emotional & Social Well-Being": [["stress","stressLevel"],["stressCause"],["abuse"],["pregnancyAbuse"]],
};
export default function PaperForm({ kind, answers, onChange, readOnly = false, blank = false }: { kind: string; answers: Answers; onChange: (key: string, value: string | string[]) => void; readOnly?: boolean; blank?: boolean }) {
  const template = FORM_TEMPLATES[kind];
  const values = blank ? {} : answers;
  const continuation: Array<{ page: number; label: string; value: string }> = [];
  function field(field: PaperField, page: number) {
    const value = values[field.key] ?? (field.multiple ? [] : "");
    const aria = field.label || field.key.replace(/([a-z])([A-Z])/g, "$1 $2");
    const id = `paper-${field.key}`;
    const writeIn = ["ethnicityOther","languageOther","householdOther","supportOther","symptomsOther","birthControlOther","needsOther"].includes(field.key);
    if (field.type === "choices") return <fieldset className={`paper-choice-field ${field.label ? "" : "paper-unlabelled"}`} key={id}><legend className={field.label ? "" : "sr-only"}>{aria}</legend><div className="paper-options">{field.options?.map(option => <label key={option}><input type={field.multiple ? "checkbox" : "radio"} name={id} checked={field.multiple ? Array.isArray(value) && value.includes(option) : value === option} disabled={readOnly} onChange={() => onChange(field.key, field.multiple ? (Array.isArray(value) && value.includes(option) ? value.filter(x => x !== option) : [...(Array.isArray(value) ? value : []), option]) : option)} onClick={() => { if (!field.multiple && value === option && !readOnly) onChange(field.key, ""); }} />{option}</label>)}</div></fieldset>;
    const printCapacity = field.type === "long" ? 160 : field.key === "middleInitial" ? 3 : writeIn || /name/i.test(field.key) ? 28 : 48;
    const long = typeof value === "string" && value.length > printCapacity;
    if (long) continuation.push({ page, label: aria, value });
    return <div className={`paper-field ${field.type === "long" ? "paper-long" : ""} ${writeIn ? "paper-write-in" : ""}`} key={id}><label htmlFor={id} className={writeIn ? "sr-only" : ""}>{field.label || <span className="sr-only">{aria}</span>}</label>{field.type === "long" ? <textarea id={id} value={String(value)} readOnly={readOnly} maxLength={10000} onChange={e => onChange(field.key,e.target.value)} rows={2} /> : <input id={id} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} min={field.key === "stressLevel" ? 1 : 0} max={field.max ?? (field.type === "number" ? 1000 : undefined)} value={String(value)} readOnly={readOnly} maxLength={10000} onChange={e => onChange(field.key,e.target.value)} /> }<span className="paper-print-value">{long ? "See continuation" : String(value)}</span>{field.suffix && <span>{field.suffix}</span>}</div>;
  }
  return <div data-oyama-authored className={`paper-document ${kind === "CASE_INTAKE" ? "paper-case" : "paper-health"}`}>
    {template.pages.map((sections, index) => <article id={`paper-page-${index+1}`} aria-label={`${template.title}, page ${index+1}`} className={`paper-page paper-page-${index+1}`} key={index}>
      {(index === 0 || (kind === "CASE_INTAKE" && index === 2)) && <img className="paper-logo" src="/compassion/pregnancy-care-center-logo.png" alt="The Pregnancy Care Center" />}
      {index === 0 && <><h1 className="paper-center-name">The Pregnancy Care Center</h1><div className="paper-title"><strong>{template.title}</strong>{kind === "CASE_INTAKE" && <em> -{CASE_INTRO}</em>}</div></>}
      {sections.map((s, si) => <section className="paper-section" key={si}>{s.title && <h2>{kind==="CASE_INTAKE"&&index===2&&si===0?<>More about our Facility<br/>and Request for Services</>:s.title}</h2>}{s.text?.map((paragraph,i) => <p className={s.text!.length > 1 ? "paper-bullet" : ""} key={i}>{paragraph}</p>)}
        {(kind==="CASE_INTAKE"&&index===2&&si===1?[["requestPrintedName","requestSignature"],["requestDate"]]:(groups[s.title] ?? s.fields.map(f => [f.key]))).map((row, ri) => <div className="paper-row" key={ri}>{row.map(key => { const definition = s.fields.find(f => f.key === key); return definition ? field(definition,index+1) : null; })}</div>)}
      </section>)}
    </article>)}
    {continuation.length > 0 && <article className="paper-page paper-continuation"><h2>{template.title} — continuation</h2>{continuation.map(item => <section key={`${item.page}-${item.label}`}><h3>Page {item.page} · {item.label}</h3><p>{item.value}</p></section>)}</article>}
  </div>;
}
