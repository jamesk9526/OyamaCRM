// Merge workflow for detecting and resolving duplicate constituent records.
"use client";

import { useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Constituent record shape used in the merge workflow */
export interface MergeConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  donorStatus: string;
}

/** A suspected duplicate pair */
interface DuplicatePair {
  a: MergeConstituent;
  b: MergeConstituent;
  /** How the match was detected: "email" or "name" */
  matchReason: "email" | "name";
}

interface MergeWorkflowProps {
  /** All loaded constituents to scan for duplicates */
  constituents: MergeConstituent[];
}

// ─── Fields shown in the side-by-side comparison ──────────────────────────────

/** Display labels for the comparison table */
const COMPARE_FIELDS: Array<{ key: keyof MergeConstituent; label: string }> = [
  { key: "firstName",   label: "First Name"   },
  { key: "lastName",    label: "Last Name"    },
  { key: "email",       label: "Email"        },
  { key: "phone",       label: "Phone"        },
  { key: "city",        label: "City"         },
  { key: "state",       label: "State"        },
  { key: "donorStatus", label: "Donor Status" },
];

// ─── Duplicate detection ───────────────────────────────────────────────────────

/**
 * findDuplicates: scans all constituents for potential duplicates.
 * Matches on: identical email, OR same last name + first name containment.
 * Returns at most 50 pairs to keep the UI manageable.
 */
function findDuplicates(constituents: MergeConstituent[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>(); // avoid symmetric duplicates

  for (let i = 0; i < constituents.length; i++) {
    for (let j = i + 1; j < constituents.length; j++) {
      const a = constituents[i];
      const b = constituents[j];

      // Pairwise key to prevent duplicate pair insertion
      const pairKey = `${a.id}|${b.id}`;
      if (seen.has(pairKey)) continue;

      const emailMatch =
        a.email && b.email &&
        a.email.toLowerCase().trim() === b.email.toLowerCase().trim();

      const nameMatch =
        a.lastName.toLowerCase() === b.lastName.toLowerCase() &&
        (a.firstName.toLowerCase().includes(b.firstName.toLowerCase()) ||
         b.firstName.toLowerCase().includes(a.firstName.toLowerCase()));

      if (emailMatch || nameMatch) {
        pairs.push({ a, b, matchReason: emailMatch ? "email" : "name" });
        seen.add(pairKey);
      }

      // Cap results for performance
      if (pairs.length >= 50) return pairs;
    }
  }

  return pairs;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/**
 * DuplicateList: shows a list of detected duplicate pairs. Each row is clickable.
 */
function DuplicateList({
  pairs,
  onSelect,
  skipped,
}: {
  pairs: DuplicatePair[];
  onSelect: (pair: DuplicatePair) => void;
  skipped: Set<string>;
}) {
  if (pairs.length === 0) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-6 text-center text-sm text-green-700">
        ✓ No suspected duplicates found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => {
        const key = `${pair.a.id}|${pair.b.id}`;
        if (skipped.has(key)) return null;
        return (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onSelect(pair)}
          >
            {/* Match reason badge */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
              pair.matchReason === "email" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
            }`}>
              {pair.matchReason === "email" ? "Same email" : "Similar name"}
            </span>
            <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
              {pair.a.firstName} {pair.a.lastName}
              <span className="text-gray-400 mx-1">vs</span>
              {pair.b.firstName} {pair.b.lastName}
            </span>
            <span className="text-xs text-blue-600">Review →</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * MergeEditor: side-by-side comparison of two records.
 * Lets the user pick which value to keep for each field.
 */
function MergeEditor({
  pair,
  onSkip,
  onMerge,
}: {
  pair: DuplicatePair;
  onSkip: () => void;
  onMerge: (merged: MergeConstituent) => void;
}) {
  // selections[fieldKey] = "a" | "b"
  const [selections, setSelections] = useState<Record<string, "a" | "b">>(() => {
    // Default: keep the non-empty value; prefer "a" on tie
    const s: Record<string, "a" | "b"> = {};
    for (const { key } of COMPARE_FIELDS) {
      const aVal = String(pair.a[key] ?? "").trim();
      const bVal = String(pair.b[key] ?? "").trim();
      s[key] = bVal && !aVal ? "b" : "a";
    }
    return s;
  });

  const [preview, setPreview] = useState(false);
  const [merged, setMerged] = useState(false);

  /** Build the merged record from current radio selections */
  function buildMerged(): MergeConstituent {
    const result: Partial<MergeConstituent> = { id: pair.a.id };
    for (const { key } of COMPARE_FIELDS) {
      // Dynamic key assignment into a Partial — safe since key comes from COMPARE_FIELDS
      result[key] = selections[key] === "a" ? pair.a[key] : pair.b[key];
    }
    return result as MergeConstituent;
  }

  if (merged) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-6 text-center text-sm text-green-700 space-y-2">
        <p className="font-semibold">✓ Merge recorded (preview only)</p>
        <p className="text-xs text-gray-500">
          {/* TODO: POST to /api/constituents/merge endpoint — not yet implemented */}
          Backend merge endpoint not yet implemented. The merged preview was shown but no data was changed.
        </p>
        <button onClick={onSkip} className="mt-2 px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white">
          Continue to next pair
        </button>
      </div>
    );
  }

  if (preview) {
    const result = buildMerged();
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-3">Merged Record Preview</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {COMPARE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="text-gray-900 font-medium">{String(result[key] ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Edit</button>
          <button
            onClick={() => { onMerge(result); setMerged(true); }}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            Confirm Merge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="text-sm min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-28">Field</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Record A
                <span className="ml-1.5 text-[10px] text-gray-400 font-normal">ID: {pair.a.id.slice(-6)}</span>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Record B
                <span className="ml-1.5 text-[10px] text-gray-400 font-normal">ID: {pair.b.id.slice(-6)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_FIELDS.map(({ key, label }) => {
              const aVal = String(pair.a[key] ?? "—");
              const bVal = String(pair.b[key] ?? "—");
              const differ = aVal !== bVal;
              return (
                <tr key={key} className={`border-t border-gray-100 ${differ ? "bg-yellow-50/40" : ""}`}>
                  <td className="px-4 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{label}</td>
                  {/* Record A */}
                  <td className="px-4 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`merge_${key}`}
                        checked={selections[key] === "a"}
                        onChange={() => setSelections((s) => ({ ...s, [key]: "a" }))}
                        className="accent-blue-600"
                      />
                      <span className={`text-sm ${selections[key] === "a" ? "text-blue-700 font-medium" : "text-gray-600"}`}>{aVal}</span>
                    </label>
                  </td>
                  {/* Record B */}
                  <td className="px-4 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`merge_${key}`}
                        checked={selections[key] === "b"}
                        onChange={() => setSelections((s) => ({ ...s, [key]: "b" }))}
                        className="accent-blue-600"
                      />
                      <span className={`text-sm ${selections[key] === "b" ? "text-blue-700 font-medium" : "text-gray-600"}`}>{bVal}</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button onClick={onSkip} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Not a duplicate</button>
        <button onClick={() => setPreview(true)} className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500">
          Preview Merge →
        </button>
      </div>
    </div>
  );
}

// ─── Main workflow ─────────────────────────────────────────────────────────────

/**
 * MergeWorkflow: detects potential duplicate constituent records and provides
 * a side-by-side UI for picking which field values to keep before merging.
 * Backend merge endpoint not yet implemented — shows preview only.
 */
export default function MergeWorkflow({ constituents }: MergeWorkflowProps) {
  const [pairs, setPairs]         = useState<DuplicatePair[] | null>(null);
  const [selected, setSelected]   = useState<DuplicatePair | null>(null);
  const [skipped, setSkipped]     = useState<Set<string>>(new Set());
  const [scanning, setScanning]   = useState(false);

  /** Kick off duplicate scan — wrapped in timeout to allow UI to update first */
  function scan() {
    setScanning(true);
    setSelected(null);
    setPairs(null);
    setTimeout(() => {
      setPairs(findDuplicates(constituents));
      setScanning(false);
    }, 200);
  }

  function skipPair(pair: DuplicatePair) {
    const key = `${pair.a.id}|${pair.b.id}`;
    setSkipped((s) => new Set([...s, key]));
    setSelected(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleMerge(_merged: MergeConstituent) {
    // TODO: POST to /api/constituents/merge endpoint — not yet implemented
    // After backend is wired, remove the pair from the list and refresh data quality
    const key = `${selected!.a.id}|${selected!.b.id}`;
    setSkipped((s) => new Set([...s, key]));
  }

  const activePairs = (pairs ?? []).filter((p) => !skipped.has(`${p.a.id}|${p.b.id}`));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Merge Duplicate Records</h2>
          <p className="text-sm text-gray-500">Find and merge constituent records that may represent the same person.</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning || constituents.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 shrink-0"
        >
          {scanning ? (
            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scanning…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Find Duplicate Constituents
            </>
          )}
        </button>
      </div>

      {pairs === null && !scanning && (
        <p className="text-sm text-gray-400 text-center py-6">Click &ldquo;Find Duplicate Constituents&rdquo; to start scanning.</p>
      )}

      {pairs !== null && !selected && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Found <strong>{activePairs.length}</strong> suspected duplicate pair{activePairs.length !== 1 ? "s" : ""}.
            {skipped.size > 0 && ` (${skipped.size} dismissed)`}
          </p>
          <DuplicateList pairs={activePairs} onSelect={setSelected} skipped={skipped} />
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <button onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline">← Back to list</button>
          <MergeEditor
            pair={selected}
            onSkip={() => skipPair(selected)}
            onMerge={handleMerge}
          />
        </div>
      )}
    </div>
  );
}
