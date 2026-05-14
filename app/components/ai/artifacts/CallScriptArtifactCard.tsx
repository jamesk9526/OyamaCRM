"use client";

import { useState } from "react";
import type { StewardCallScriptArtifact } from "@/app/components/ai/steward-artifact-types";

interface CallScriptArtifactCardProps {
  artifact: StewardCallScriptArtifact;
}

function composeScript(artifact: StewardCallScriptArtifact): string {
  return [
    artifact.openingLine ? `Opening line: ${artifact.openingLine}` : "",
    artifact.donorContext ? `Donor context: ${artifact.donorContext}` : "",
    artifact.talkingPoints && artifact.talkingPoints.length > 0
      ? `Talking points:\n${artifact.talkingPoints.map((item) => `- ${item}`).join("\n")}`
      : "",
    artifact.nextStep ? `Next step: ${artifact.nextStep}` : "",
  ].filter(Boolean).join("\n\n");
}

export default function CallScriptArtifactCard({ artifact }: CallScriptArtifactCardProps) {
  const [notice, setNotice] = useState("");

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(composeScript(artifact));
      setNotice("Call script copied.");
    } catch {
      setNotice("Could not copy call script.");
    }
  }

  return (
    <article className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cyan-900">{artifact.title || "Call Script"}</h4>
        <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[11px] text-cyan-700">Script</span>
      </header>

      {artifact.openingLine && (
        <div className="rounded-lg border border-cyan-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-cyan-800">Opening Line</p>
          <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{artifact.openingLine}</p>
        </div>
      )}

      {artifact.donorContext && (
        <p className="text-xs text-slate-600">Context: {artifact.donorContext}</p>
      )}

      {artifact.talkingPoints && artifact.talkingPoints.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-cyan-800">Talking Points</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 space-y-0.5">{artifact.talkingPoints.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {artifact.nextStep && <p className="text-xs text-slate-700">Next step: {artifact.nextStep}</p>}

      <button type="button" onClick={() => void copyScript()} className="rounded-md border border-cyan-300 bg-white px-2 py-1 text-[11px] font-medium text-cyan-800 hover:bg-cyan-100">Copy Script</button>
      {notice && <p className="text-[11px] text-cyan-700">{notice}</p>}
    </article>
  );
}
