"use client";

import { useMemo, useState } from "react";
import type { StewardDonorListArtifact } from "@/app/components/ai/steward-artifact-types";

interface DonorListArtifactCardProps {
  artifact: StewardDonorListArtifact;
}

function toCsv(artifact: StewardDonorListArtifact): string {
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

function toText(artifact: StewardDonorListArtifact): string {
  return (artifact.rows || [])
    .map((row, index) => {
      const name = String(row.name ?? row.donorName ?? `Donor ${index + 1}`);
      const amount = row.amount ?? row.givingAmount ?? "";
      const lastGift = row.lastGiftDate ?? row.lastGift ?? "";
      const status = row.donorStatus ?? row.status ?? "";
      const next = row.nextStep ?? "";
      return `${index + 1}. ${name}${amount ? ` | ${amount}` : ""}${lastGift ? ` | last gift ${lastGift}` : ""}${status ? ` | status ${status}` : ""}${next ? ` | next ${next}` : ""}`;
    })
    .join("\n");
}

export default function DonorListArtifactCard({ artifact }: DonorListArtifactCardProps) {
  const [notice, setNotice] = useState("");

  const columns = useMemo(() => {
    if (artifact.columns && artifact.columns.length > 0) return artifact.columns;
    return Array.from(new Set((artifact.rows || []).flatMap((row) => Object.keys(row))));
  }, [artifact.columns, artifact.rows]);

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value || "");
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-blue-900">{artifact.title || "Donor List"}</h4>
        <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] text-blue-700">List</span>
      </header>

      <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-blue-100/60 text-blue-900">
            <tr>{columns.map((column) => <th key={column} className="px-2 py-1 text-left font-semibold">{column}</th>)}</tr>
          </thead>
          <tbody>
            {(artifact.rows || []).map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-t border-blue-100">
                {columns.map((column) => <td key={`${rowIndex}-${column}`} className="px-2 py-1 text-slate-700">{String(row[column] ?? "-")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyValue("Donor List text", toText(artifact))} className="rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100">Copy As Text</button>
        <button type="button" onClick={() => void copyValue("Donor List CSV", toCsv(artifact))} className="rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100">Copy As CSV</button>
      </div>

      {notice && <p className="text-[11px] text-blue-700">{notice}</p>}
    </article>
  );
}
