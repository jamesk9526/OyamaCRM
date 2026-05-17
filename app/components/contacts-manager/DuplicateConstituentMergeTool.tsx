/** Review-first duplicate constituent merge tool for Contacts Manager. */
"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employer?: string | null;
  donorStatus: string;
  totalLifetimeGiving?: number | string | null;
  tags?: Array<{ tag: { name: string; color: string } }>;
}

interface DuplicateMergeToolProps {
  constituents: ConstituentRow[];
  onReload: () => Promise<void>;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}

interface MergeCandidate {
  key: string;
  keep: ConstituentRow;
  merge: ConstituentRow;
  reason: string;
  score: number;
}

/** DuplicateConstituentMergeTool scans matching names and requires approval before merging records. */
export default function DuplicateConstituentMergeTool({ constituents, onReload, onMessage, onError }: DuplicateMergeToolProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [processingKey, setProcessingKey] = useState("");

  const candidates = useMemo(() => findNameDuplicateCandidates(constituents).filter((candidate) => !dismissed.has(candidate.key)), [constituents, dismissed]);

  async function approve(candidate: MergeCandidate) {
    setProcessingKey(candidate.key);
    try {
      await apiFetch("/api/constituents/merge", {
        method: "POST",
        body: JSON.stringify({ keepId: candidate.keep.id, mergeId: candidate.merge.id }),
      });
      await onReload();
      onMessage?.(`Merged ${contactName(candidate.merge)} into ${contactName(candidate.keep)}.`);
      setDismissed((prev) => new Set(prev).add(candidate.key));
    } catch (requestError) {
      onError?.(requestError instanceof Error ? requestError.message : "Failed to merge duplicate constituent.");
    } finally {
      setProcessingKey("");
    }
  }

  function decline(candidate: MergeCandidate) {
    setDismissed((prev) => new Set(prev).add(candidate.key));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        This tool scans constituents by normalized first and last name to find records that may be the same person. Each row must be approved or declined. Approved merges keep the stronger profile, move giving/history/tags to it, and remove only the duplicate record.
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Potential Matches" value={candidates.length.toLocaleString()} />
        <Metric label="Scanned Constituents" value={constituents.length.toLocaleString()} />
        <Metric label="Declined This Session" value={dismissed.size.toLocaleString()} />
      </div>

      <div className="max-h-[62vh] overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-[1040px] divide-y divide-gray-200 text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Possible Same Person</th>
              <th className="px-3 py-2">Keep This Record</th>
              <th className="px-3 py-2">Merge This Duplicate</th>
              <th className="px-3 py-2">Why Flagged</th>
              <th className="px-3 py-2 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No likely same-name duplicates are currently visible.</td></tr>
            ) : candidates.map((candidate) => (
              <tr key={candidate.key} className="bg-white hover:bg-gray-50">
                <td className="px-3 py-2 font-semibold text-gray-900">{contactName(candidate.keep)}</td>
                <td className="px-3 py-2">{renderRecord(candidate.keep)}</td>
                <td className="px-3 py-2">{renderRecord(candidate.merge)}</td>
                <td className="px-3 py-2 text-gray-600">{candidate.reason}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => void approve(candidate)} disabled={processingKey === candidate.key} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">Yes, Merge</button>
                    <button type="button" onClick={() => decline(candidate)} disabled={processingKey === candidate.key} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">No</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function renderRecord(row: ConstituentRow) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-gray-900">{contactName(row)}</p>
      <p className="truncate text-gray-500">{row.email || "No email"} · {row.phone || "No phone"}</p>
      <p className="truncate text-gray-500">{row.employer || "No organization"} · {formatMoney(row.totalLifetimeGiving)} lifetime</p>
    </div>
  );
}

function findNameDuplicateCandidates(rows: ConstituentRow[]): MergeCandidate[] {
  const groups = new Map<string, ConstituentRow[]>();
  for (const row of rows) {
    const key = normalizeNameKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const candidates: MergeCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => profileScore(b) - profileScore(a));
    const keep = ranked[0];
    for (const merge of ranked.slice(1)) {
      candidates.push({
        key: `${keep.id}:${merge.id}`,
        keep,
        merge,
        reason: buildReason(keep, merge),
        score: profileScore(keep) + profileScore(merge),
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function normalizeNameKey(row: ConstituentRow): string {
  const first = normalizeNamePart(row.firstName);
  const last = normalizeNamePart(row.lastName);
  if (!first || !last) return "";
  return `${first}:${last}`;
}

function normalizeNamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function profileScore(row: ConstituentRow): number {
  return [
    row.email,
    row.phone,
    row.employer,
    Number(row.totalLifetimeGiving ?? 0) > 0 ? "giving" : "",
    ...(row.tags?.map((entry) => entry.tag.name) ?? []),
  ].filter(Boolean).length;
}

function buildReason(a: ConstituentRow, b: ConstituentRow): string {
  const reasons = ["same normalized first and last name"];
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) reasons.push("same email");
  if (a.phone && b.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) reasons.push("same phone");
  return reasons.join(", ");
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function contactName(row: ConstituentRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Unnamed constituent";
}

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";
}
