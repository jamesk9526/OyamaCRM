"use client";

import { useState } from "react";
import type { StewardReportSummaryArtifact } from "@/app/components/ai/steward-artifact-types";

interface ReportSummaryArtifactCardProps {
  artifact: StewardReportSummaryArtifact;
}

function composeCopyText(artifact: StewardReportSummaryArtifact): string {
  return [
    artifact.headline ? `Headline: ${artifact.headline}` : "",
    artifact.boardSummary ? `\nBoard Summary:\n${artifact.boardSummary}` : "",
    artifact.keyMetrics && artifact.keyMetrics.length > 0 ? `\nKey Metrics:\n${artifact.keyMetrics.map((item) => `- ${item}`).join("\n")}` : "",
    artifact.risks && artifact.risks.length > 0 ? `\nRisks:\n${artifact.risks.map((item) => `- ${item}`).join("\n")}` : "",
    artifact.opportunities && artifact.opportunities.length > 0 ? `\nOpportunities:\n${artifact.opportunities.map((item) => `- ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

export default function ReportSummaryArtifactCard({ artifact }: ReportSummaryArtifactCardProps) {
  const [notice, setNotice] = useState("");

  async function copyBoardSummary() {
    try {
      await navigator.clipboard.writeText(composeCopyText(artifact));
      setNotice("Board summary copied.");
    } catch {
      setNotice("Could not copy board summary.");
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Steward Report</p>
          <h4 className="mt-1 text-sm font-semibold text-slate-950">{artifact.title || "Report Summary"}</h4>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Summary</span>
      </header>

      <div className="space-y-3 px-4 py-3">
      {artifact.headline && <p className="text-base font-semibold leading-6 text-slate-950">{artifact.headline}</p>}
      {artifact.boardSummary && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{artifact.boardSummary}</p>}

      {artifact.keyMetrics && artifact.keyMetrics.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Key Metrics</p>
          <ul className="mt-2 grid gap-1.5 text-xs text-slate-700 sm:grid-cols-2">{artifact.keyMetrics.map((item) => <li key={item} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">{item}</li>)}</ul>
        </div>
      )}

      {artifact.risks && artifact.risks.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Risks</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-800">{artifact.risks.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
      )}

      {artifact.opportunities && artifact.opportunities.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Opportunities</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-800">{artifact.opportunities.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void copyBoardSummary()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">Copy For Board Report</button>
        {notice && <p className="text-[11px] text-emerald-700">{notice}</p>}
      </div>
      </div>
    </article>
  );
}
