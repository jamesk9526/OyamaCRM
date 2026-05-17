"use client";

import { useState } from "react";
import Link from "next/link";
import type { StewardEmailDraftArtifact } from "@/app/components/ai/steward-artifact-types";

interface EmailDraftArtifactCardProps {
  artifact: StewardEmailDraftArtifact;
}

function getBodyText(artifact: StewardEmailDraftArtifact): string {
  return artifact.bodyPlainText || artifact.bodyMarkdown || artifact.body || "";
}

function joinDraftText(artifact: StewardEmailDraftArtifact): string {
  const bodyText = getBodyText(artifact);
  const parts = [
    artifact.subject ? `Subject: ${artifact.subject}` : "",
    artifact.previewText ? `Preview: ${artifact.previewText}` : "",
    "",
    bodyText,
  ];
  return parts.filter(Boolean).join("\n");
}

export default function EmailDraftArtifactCard({ artifact }: EmailDraftArtifactCardProps) {
  const [notice, setNotice] = useState("");
  const bodyText = getBodyText(artifact);

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value || "");
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-emerald-900">{artifact.title || "Email Draft"}</h4>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700">Draft</span>
      </header>

      {artifact.audience && <p className="text-xs text-emerald-800">Audience: {artifact.audience}</p>}

      {artifact.previewText && (
        <div className="rounded-lg border border-emerald-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-emerald-800">Preview Text</p>
          <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{artifact.previewText}</p>
        </div>
      )}

      <div className="rounded-lg border border-emerald-200 bg-white p-2">
        <p className="text-[11px] font-semibold text-emerald-800">Subject</p>
        <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{artifact.subject}</p>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-white p-2">
        <p className="text-[11px] font-semibold text-emerald-800">Body</p>
        <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{bodyText}</p>
      </div>

      {artifact.warnings && artifact.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-[11px] font-semibold text-amber-800">Warnings</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-800 space-y-0.5">
            {artifact.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyValue("Subject", artifact.subject)} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Copy Subject</button>
        {artifact.previewText && (
          <button type="button" onClick={() => void copyValue("Preview Text", artifact.previewText || "")} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Copy Preview</button>
        )}
        <button type="button" onClick={() => void copyValue("Body", bodyText)} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Copy Body</button>
        {artifact.bodyHtml && (
          <button type="button" onClick={() => void copyValue("HTML", artifact.bodyHtml || "")} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Copy HTML</button>
        )}
        <button type="button" onClick={() => void copyValue("Full Email", joinDraftText(artifact))} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Copy Full Email</button>
        <Link href="/communications" className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Open Communications</Link>
      </div>

      {notice && <p className="text-[11px] text-emerald-700">{notice}</p>}
    </article>
  );
}
