/**
 * EnhancedDonorListArtifactCard — improved donor/constituent list with sorting,
 * filtering, and export capabilities. Supports CSV export and interactive table.
 */
"use client";

import { useMemo, useState } from "react";
import type { StewardDonorListArtifact } from "@/app/components/ai/steward-artifact-types";

interface EnhancedDonorListArtifactCardProps {
  artifact: StewardDonorListArtifact;
}

type SortDir = "asc" | "desc" | null;

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

function downloadCsv(artifact: StewardDonorListArtifact) {
  const csvText = toCsv(artifact);
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.title?.replace(/\s+/g, "-").toLowerCase() || "donor-list.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EnhancedDonorListArtifactCard({ artifact }: EnhancedDonorListArtifactCardProps) {
  const [notice, setNotice] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const columns = useMemo(() => {
    if (artifact.columns && artifact.columns.length > 0) return artifact.columns;
    return Array.from(new Set((artifact.rows || []).flatMap((row) => Object.keys(row))));
  }, [artifact.columns, artifact.rows]);

  const filteredAndSorted = useMemo(() => {
    let rows = [...(artifact.rows || [])];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((val) =>
          String(val ?? "").toLowerCase().includes(term)
        )
      );
    }

    // Sort
    if (sortColumn && sortDir) {
      rows.sort((a, b) => {
        const aVal = String(a[sortColumn] ?? "");
        const bVal = String(b[sortColumn] ?? "");

        // Try numeric sort
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String sort
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [artifact.rows, sortColumn, sortDir, searchTerm]);

  function toggleSort(column: string) {
    if (sortColumn === column) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortColumn(null);
        setSortDir(null);
      }
    } else {
      setSortColumn(column);
      setSortDir("asc");
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value || "");
      setNotice(`${label} copied.`);
      setTimeout(() => setNotice(""), 2000);
    } catch {
      setNotice(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  const rowCount = filteredAndSorted.length;
  const totalRows = artifact.rows?.length || 0;

  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-blue-900">{artifact.title || "Donor List"}</h4>
        <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] text-blue-700">
          {rowCount} {rowCount === 1 ? "row" : "rows"}
        </span>
      </header>

      {artifact.description && <p className="text-xs text-blue-800">{artifact.description}</p>}

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-2 py-1 rounded border border-blue-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />

        {/* Export button */}
        <button
          onClick={() => {
            downloadCsv(artifact);
            setNotice("CSV downloaded.");
            setTimeout(() => setNotice(""), 2000);
          }}
          className="px-2 py-1 rounded border border-blue-300 bg-white text-xs text-blue-700 hover:bg-blue-50 font-medium transition"
        >
          Export CSV
        </button>
      </div>

      {/* Status message */}
      {notice && <p className="text-xs text-blue-700 font-medium">{notice}</p>}

      {/* Filtered count */}
      {searchTerm && rowCount < totalRows && (
        <p className="text-xs text-slate-600">
          Showing {rowCount} of {totalRows} rows
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-blue-100 bg-blue-50/50">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="px-3 py-2 text-left font-semibold text-blue-900 hover:bg-blue-100 cursor-pointer transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortColumn === col && (
                      <span className="text-blue-600">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  {searchTerm ? "No matching rows" : "No rows available"}
                </td>
              </tr>
            ) : (
              filteredAndSorted.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="border-b border-blue-50 hover:bg-blue-50/30 transition">
                  {columns.map((col) => (
                    <td
                      key={`${idx}-${col}`}
                      className="px-3 py-2 text-slate-700 truncate max-w-xs"
                      title={String(row[col] ?? "")}
                    >
                      {String(row[col] ?? "").slice(0, 50)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Note if truncated */}
      {filteredAndSorted.length > 50 && (
        <p className="text-xs text-slate-500">
          Showing first 50 of {filteredAndSorted.length} rows. Download CSV to see all.
        </p>
      )}
    </article>
  );
}
