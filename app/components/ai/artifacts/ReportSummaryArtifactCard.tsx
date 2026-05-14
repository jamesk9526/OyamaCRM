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
    <article className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-purple-900">{artifact.title || "Report Summary"}</h4>
        <span className="rounded-full border border-purple-200 bg-white px-2 py-0.5 text-[11px] text-purple-700">Summary</span>
      </header>

      {artifact.headline && <p className="text-sm font-medium text-purple-900">{artifact.headline}</p>}
      {artifact.boardSummary && <p className="text-sm text-slate-700 whitespace-pre-wrap">{artifact.boardSummary}</p>}

      {artifact.keyMetrics && artifact.keyMetrics.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-purple-800">Key Metrics</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 space-y-0.5">{artifact.keyMetrics.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {artifact.risks && artifact.risks.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-rose-700">Risks</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 space-y-0.5">{artifact.risks.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {artifact.opportunities && artifact.opportunities.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-700">Opportunities</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 space-y-0.5">{artifact.opportunities.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <button type="button" onClick={() => void copyBoardSummary()} className="rounded-md border border-purple-300 bg-white px-2 py-1 text-[11px] font-medium text-purple-800 hover:bg-purple-100">Copy For Board Report</button>
      {notice && <p className="text-[11px] text-purple-700">{notice}</p>}
    </article>
  );
}
