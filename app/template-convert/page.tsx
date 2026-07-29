"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import { apiFetch } from "@/app/lib/auth-client";

type Template = { id: string; name: string; subject?: string | null; printSubject?: string | null; bodyHtml?: string | null; bodyText?: string | null; printBody?: string | null; emailBody?: string | null; updatedAt?: string };
type Direction = "email-to-letter" | "letter-to-email";

export default function TemplateConvertPage() {
  const [direction, setDirection] = useState<Direction>("email-to-letter");
  const [emails, setEmails] = useState<Template[]>([]);
  const [letters, setLetters] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<Template[]>("/api/oyama-email/templates"), apiFetch<Template[]>("/api/letters/templates")])
      .then(([emailRows, letterRows]) => { setEmails(emailRows); setLetters(letterRows); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load templates."));
  }, []);
  const sourceTemplates = direction === "email-to-letter" ? emails : letters;
  const selected = useMemo(() => sourceTemplates.find((template) => template.id === selectedId) ?? null, [sourceTemplates, selectedId]);
  const sourceText = selected ? (direction === "email-to-letter" ? selected.bodyText || selected.bodyHtml || "" : selected.printBody || selected.emailBody || "") : "";
  const targetTitle = selected ? `${direction === "email-to-letter" ? "Printable letter" : "Email template"}: ${selected.name}` : "Choose a template";

  useEffect(() => setSelectedId(sourceTemplates[0]?.id ?? ""), [direction, emails, letters]);

  async function convert() {
    if (!selected) return;
    setWorking(true); setError(null);
    try {
      const url = direction === "email-to-letter"
        ? `/api/oyama-email/templates/${selected.id}/create-letter-template`
        : `/api/letters/templates/${selected.id}/create-oyama-email-template`;
      const response = await apiFetch<{ redirectTo: string }>(url, { method: "POST" });
      window.location.assign(response.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed. No template was changed.");
      setWorking(false);
    }
  }

  return <EnterprisePageShell>
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="rounded-xl border border-[#c7e0f4] bg-[linear-gradient(105deg,#eff6fc,#fff)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f6cbd]">Communication tools</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Convert with a live review</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Conversion creates a new draft. Your original stays unchanged, and templates that began in OyamaEmail retain their structured document for a lossless return trip.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {([ ["email-to-letter", "Email → Letter"], ["letter-to-email", "Letter → Email"] ] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={direction === value} onClick={() => setDirection(value)} className={`rounded-[3px] px-4 py-2 text-sm font-semibold ${direction === value ? "bg-[#0f6cbd] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="px-2 text-sm font-semibold text-slate-900">{direction === "email-to-letter" ? "Email templates" : "Letter templates"}</h2>
          <div className="mt-3 space-y-1">{sourceTemplates.map((template) => <button key={template.id} onClick={() => setSelectedId(template.id)} className={`w-full rounded-md px-3 py-3 text-left ${selectedId === template.id ? "bg-[#eff6fc] text-[#0f548c] ring-1 ring-[#0f6cbd]" : "hover:bg-slate-50"}`}><span className="block truncate text-sm font-semibold">{template.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{template.subject || template.printSubject || "No subject"}</span></button>)}</div>
          {!sourceTemplates.length ? <p className="p-3 text-sm text-slate-500">No draft templates available.</p> : null}
        </aside>
        <PreviewCard title="Source preview" content={sourceText} empty="Select a template to inspect its editable source." />
        <PreviewCard title={targetTitle} content={sourceText} empty="The converted companion will appear here after selecting a source." converted />
      </div>
      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Review the content, then create a new editable companion. You will be taken directly to its builder.</p><div className="flex gap-2"><Link href={direction === "email-to-letter" ? "/oyama-email/templates" : "/oyama-letters"} className="rounded-[3px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Open source library</Link><button onClick={convert} disabled={!selected || working} className="rounded-[3px] bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{working ? "Creating…" : "Create reviewed companion"}</button></div></div>
    </div>
  </EnterprisePageShell>;
}

function PreviewCard({ title, content, empty, converted = false }: { title: string; content: string; empty: string; converted?: boolean }) {
  return <section className="min-h-[430px] overflow-hidden rounded-lg border border-slate-200 bg-white"><header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{converted ? <span className="text-xs font-medium text-[#0f6cbd]">Draft preview</span> : null}</header><div className="p-5"><div className="min-h-[330px] whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{content || empty}</div></div></section>;
}
