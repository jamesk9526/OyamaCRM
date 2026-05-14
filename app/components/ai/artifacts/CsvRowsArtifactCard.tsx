"use client";

import { useMemo, useState } from "react";
import type { StewardCsvRowsArtifact } from "@/app/components/ai/steward-artifact-types";

interface CsvRowsArtifactCardProps {
  artifact: StewardCsvRowsArtifact;
}

function toCsv(artifact: StewardCsvRowsArtifact): string {
  const rows = artifact.rows || [];
  const columns = artifact.columns && artifact.columns.length > 0
    ? artifact.columns
    : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => {
    const raw = String(row[column] ?? "");
    return raw.includes(",") || raw.includes("\"") ? `"${raw.replace(/\"/g, '""')}"` : raw;
  }).join(","));

  return [header, ...lines].join("\n");
}

export default function CsvRowsArtifactCard({ artifact }: CsvRowsArtifactCardProps) {
  const [notice, setNotice] = useState("");

  const csvText = useMemo(() => toCsv(artifact), [artifact]);

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(csvText);
      setNotice("CSV copied.");
    } catch {
      setNotice("Could not copy CSV.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.fileName || "steward-artifact.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice("CSV downloaded.");
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{artifact.title || "CSV Rows"}</h4>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700">CSV</span>
      </header>

      <p className="text-xs text-slate-600">{artifact.rows.length} row(s)</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyCsv()} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100">Copy CSV</button>
        <button type="button" onClick={downloadCsv} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100">Download CSV</button>
      </div>

      {notice && <p className="text-[11px] text-slate-700">{notice}</p>}
    </article>
  );
}
