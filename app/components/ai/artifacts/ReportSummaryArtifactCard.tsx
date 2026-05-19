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
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Steward Report</p>
          <h4 className="mt-1 text-sm font-semibold text-white">{artifact.title || "Report Summary"}</h4>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">Summary</span>
      </header>

      <div className="space-y-3 px-4 py-3">
      {artifact.headline && <p className="text-base font-semibold leading-6 text-white">{artifact.headline}</p>}
      {artifact.boardSummary && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{artifact.boardSummary}</p>}

      {artifact.keyMetrics && artifact.keyMetrics.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Key Metrics</p>
          <ul className="mt-2 grid gap-1.5 text-xs text-slate-300 sm:grid-cols-2">{artifact.keyMetrics.map((item) => <li key={item} className="rounded-lg bg-white/[0.03] px-2.5 py-2">{item}</li>)}</ul>
        </div>
      )}

      {artifact.risks && artifact.risks.length > 0 && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">Risks</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-50/90">{artifact.risks.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
      )}

      {artifact.opportunities && artifact.opportunities.length > 0 && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Opportunities</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-50/90">{artifact.opportunities.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void copyBoardSummary()} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/10">Copy For Board Report</button>
        {notice && <p className="text-[11px] text-cyan-200">{notice}</p>}
      </div>
      </div>
    </article>
  );
}
