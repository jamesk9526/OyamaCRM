"use client";

import StewardMessageRenderer from "@/app/components/ai/StewardMessageRenderer";
import EmailDraftArtifactCard from "@/app/components/ai/artifacts/EmailDraftArtifactCard";
import DonorListArtifactCard from "@/app/components/ai/artifacts/DonorListArtifactCard";
import ReportSummaryArtifactCard from "@/app/components/ai/artifacts/ReportSummaryArtifactCard";
import TaskListArtifactCard from "@/app/components/ai/artifacts/TaskListArtifactCard";
import CallScriptArtifactCard from "@/app/components/ai/artifacts/CallScriptArtifactCard";
import CsvRowsArtifactCard from "@/app/components/ai/artifacts/CsvRowsArtifactCard";
import type {
  StewardArtifact,
  StewardStructuredResponse,
  StewardSuggestedAction,
  StewardEvidenceItem,
} from "@/app/components/ai/steward-artifact-types";

interface StewardResponseRendererProps {
  content: string;
  structured?: StewardStructuredResponse;
  tone?: "dark" | "light";
}

function renderArtifact(artifact: StewardArtifact): JSX.Element | null {
  if (artifact.type === "email_draft") {
    return <EmailDraftArtifactCard artifact={artifact} />;
  }
  if (artifact.type === "donor_list") {
    return <DonorListArtifactCard artifact={artifact} />;
  }
  if (artifact.type === "report_summary") {
    return <ReportSummaryArtifactCard artifact={artifact} />;
  }
  if (artifact.type === "task_list") {
    return <TaskListArtifactCard artifact={artifact} />;
  }
  if (artifact.type === "call_script") {
    return <CallScriptArtifactCard artifact={artifact} />;
  }
  if (artifact.type === "csv_rows") {
    return <CsvRowsArtifactCard artifact={artifact} />;
  }
  return null;
}

function SuggestedActionsList({ actions }: { actions: StewardSuggestedAction[] }) {
  if (!actions || actions.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-700">Suggested Actions</p>
      <ul className="mt-1 space-y-1 text-xs text-slate-600">
        {actions.map((action, index) => (
          <li key={`${action.actionType}-${index}`} className="rounded border border-slate-200 bg-white px-2 py-1">
            {action.label}
            {action.requiresConfirmation ? " (confirmation required)" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EvidenceList({ evidence }: { evidence: StewardEvidenceItem[] }) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-700">Evidence</p>
      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600 space-y-0.5">
        {evidence.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.label}
            {item.detail ? ` - ${item.detail}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StewardResponseRenderer({ content, structured, tone = "light" }: StewardResponseRendererProps) {
  const hasArtifacts = Boolean(structured && structured.artifacts && structured.artifacts.length > 0);
  const markdown = structured?.replyMarkdown?.trim().length ? structured.replyMarkdown : content;

  return (
    <div className="space-y-2">
      {hasArtifacts && (
        <div className="space-y-2">
          {(structured?.artifacts || []).map((artifact, index) => (
            <div key={`${artifact.type}-${index}`}>{renderArtifact(artifact)}</div>
          ))}
        </div>
      )}

      <StewardMessageRenderer content={markdown} tone={tone} />

      {structured?.parseWarning && (
        <p className="text-[11px] text-amber-700">Structured output note: {structured.parseWarning}</p>
      )}

      <SuggestedActionsList actions={structured?.suggestedActions || []} />
      <EvidenceList evidence={structured?.evidence || []} />
    </div>
  );
}
