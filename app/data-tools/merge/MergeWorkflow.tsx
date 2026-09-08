// Merge workflow for detecting and resolving duplicate constituent records.
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Constituent record shape used in the merge workflow */
export interface MergeConstituent {
  id: string;
  createdAt?: string;
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

interface MergeRequestPayload {
  keepId: string;
  mergeId?: string;
  mergeIds?: string[];
  mergedFields: Partial<MergeConstituent>;
}

interface DuplicateGroup {
  id: string;
  records: MergeConstituent[];
  pairs: DuplicatePair[];
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
 * Returns every matching pair in the loaded organization dataset.
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

    }
  }

  return pairs;
}

function duplicateGroups(pairs: DuplicatePair[]): DuplicateGroup[] {
  const recordById = new Map<string, MergeConstituent>();
  const adjacent = new Map<string, Set<string>>();
  for (const pair of pairs) {
    recordById.set(pair.a.id, pair.a);
    recordById.set(pair.b.id, pair.b);
    if (!adjacent.has(pair.a.id)) adjacent.set(pair.a.id, new Set());
    if (!adjacent.has(pair.b.id)) adjacent.set(pair.b.id, new Set());
    adjacent.get(pair.a.id)!.add(pair.b.id);
    adjacent.get(pair.b.id)!.add(pair.a.id);
  }

  const visited = new Set<string>();
  const groups: DuplicateGroup[] = [];
  for (const id of adjacent.keys()) {
    if (visited.has(id)) continue;
    const pending = [id];
    const ids: string[] = [];
    visited.add(id);
    while (pending.length > 0) {
      const current = pending.pop()!;
      ids.push(current);
      for (const neighbor of adjacent.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    const records = ids.map((recordId) => recordById.get(recordId)!).filter(Boolean);
    groups.push({
      id: [...ids].sort().join("|"),
      records,
      pairs: pairs.filter((pair) => ids.includes(pair.a.id) && ids.includes(pair.b.id)),
    });
  }
  return groups;
}

function oldestRecord(records: MergeConstituent[]): MergeConstituent {
  return [...records].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime || a.id.localeCompare(b.id);
  })[0];
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
  onMerge: (payload: MergeRequestPayload) => Promise<void>;
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
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [primaryRecord, setPrimaryRecord] = useState<"a" | "b">("a");

  /** Build merged field values from the current radio selections. */
  function buildMergedFields(): Partial<MergeConstituent> {
    const result: Partial<MergeConstituent> = {};
    for (const { key } of COMPARE_FIELDS) {
      result[key] = selections[key] === "a" ? pair.a[key] : pair.b[key];
    }
    return result;
  }

  function buildMergePayload(): MergeRequestPayload {
    return {
      keepId: primaryRecord === "a" ? pair.a.id : pair.b.id,
      mergeId: primaryRecord === "a" ? pair.b.id : pair.a.id,
      mergedFields: buildMergedFields(),
    };
  }

  if (merged) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-6 text-center text-sm text-green-700 space-y-2">
        <p className="font-semibold">✓ Merge completed</p>
        <p className="text-xs text-gray-500">The duplicate record was merged and related records were re-linked.</p>
        <button onClick={onSkip} className="mt-2 px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white">
          Continue to next pair
        </button>
      </div>
    );
  }

  if (preview) {
    const payload = buildMergePayload();
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-3">Merged Record Preview</p>
          <p className="mb-3 text-xs text-blue-700">
            Keeping record ID ending in <span className="font-semibold">{payload.keepId.slice(-6)}</span> and merging record ID ending in <span className="font-semibold">{payload.mergeId?.slice(-6)}</span>.
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {COMPARE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="text-gray-900 font-medium">{String(payload.mergedFields[key] ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Edit</button>
          <button
            onClick={() => {
              setSaving(true);
              setMergeError(null);
              void onMerge(payload)
                .then(() => setMerged(true))
                .catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : "Merge failed. Please try again.";
                  setMergeError(message);
                })
                .finally(() => setSaving(false));
            }}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            {saving ? "Merging…" : "Confirm Merge"}
          </button>
        </div>
        {mergeError && (
          <p className="text-xs text-red-600">{mergeError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Primary Record To Keep</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${primaryRecord === "a" ? "border-blue-300 bg-white" : "border-blue-100 bg-blue-50/40"}`}>
            <input
              type="radio"
              name="merge_primary_record"
              checked={primaryRecord === "a"}
              onChange={() => setPrimaryRecord("a")}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Keep Record A</span>
              <span className="block text-xs text-gray-600">ID ending in {pair.a.id.slice(-6)}</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${primaryRecord === "b" ? "border-blue-300 bg-white" : "border-blue-100 bg-blue-50/40"}`}>
            <input
              type="radio"
              name="merge_primary_record"
              checked={primaryRecord === "b"}
              onChange={() => setPrimaryRecord("b")}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Keep Record B</span>
              <span className="block text-xs text-gray-600">ID ending in {pair.b.id.slice(-6)}</span>
            </span>
          </label>
        </div>
      </div>
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
 */
export default function MergeWorkflow({ constituents }: MergeWorkflowProps) {
  const [pairs, setPairs]         = useState<DuplicatePair[] | null>(null);
  const [selected, setSelected]   = useState<DuplicatePair | null>(null);
  const [skipped, setSkipped]     = useState<Set<string>>(new Set());
  const [scanning, setScanning]   = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [bulkReview, setBulkReview] = useState(false);
  const [bulkMerging, setBulkMerging] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  /** Kick off duplicate scan — wrapped in timeout to allow UI to update first */
  function scan() {
    setScanning(true);
    setSelected(null);
    setPairs(null);
    setSelectedGroupIds(new Set());
    setBulkReview(false);
    setBulkError(null);
    setBulkSuccess(null);
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

  async function handleMerge(payload: MergeRequestPayload) {
    await apiFetch("/api/constituents/merge", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // After a successful merge, remove this pair from the review queue.
    const removedIds = new Set([payload.mergeId, ...(payload.mergeIds ?? [])].filter((id): id is string => Boolean(id)));
    setPairs((current) => (current ?? []).filter((pair) => !removedIds.has(pair.a.id) && !removedIds.has(pair.b.id)));
  }

  const activePairs = (pairs ?? []).filter((p) => !skipped.has(`${p.a.id}|${p.b.id}`));
  const groups = duplicateGroups(activePairs);
  const selectedGroups = groups.filter((group) => selectedGroupIds.has(group.id));

  async function mergeSelectedGroups() {
    if (selectedGroups.length === 0) return;
    setBulkMerging(true);
    setBulkError(null);
    let mergedGroups = 0;
    const removedIds = new Set<string>();
    try {
      for (const group of selectedGroups) {
        const keep = oldestRecord(group.records);
        const mergeIds = group.records.filter((record) => record.id !== keep.id).map((record) => record.id);
        await apiFetch("/api/constituents/merge", {
          method: "POST",
          body: JSON.stringify({ keepId: keep.id, mergeIds, mergedFields: {} }),
        });
        mergeIds.forEach((id) => removedIds.add(id));
        mergedGroups += 1;
      }
      setPairs((current) => (current ?? []).filter((pair) => !removedIds.has(pair.a.id) && !removedIds.has(pair.b.id)));
      setSelectedGroupIds(new Set());
      setBulkReview(false);
      setBulkSuccess(`Merged ${mergedGroups} duplicate group${mergedGroups === 1 ? "" : "s"}. The oldest record was retained in each group.`);
    } catch (error) {
      setBulkError(`${error instanceof Error ? error.message : "Bulk merge failed."} ${mergedGroups} group${mergedGroups === 1 ? " was" : "s were"} completed before the error.`);
    } finally {
      setBulkMerging(false);
    }
  }

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
          {groups.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={groups.length > 0 && selectedGroupIds.size === groups.length}
                    onChange={(event) => setSelectedGroupIds(event.target.checked ? new Set(groups.map((group) => group.id)) : new Set())}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Select all duplicate groups ({groups.length})
                </label>
                <button
                  type="button"
                  onClick={() => setBulkReview(true)}
                  disabled={selectedGroups.length === 0 || bulkMerging}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review merge all ({selectedGroups.length})
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {groups.map((group) => {
                  const oldest = oldestRecord(group.records);
                  return (
                    <label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(group.id)}
                        onChange={(event) => setSelectedGroupIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(group.id); else next.delete(group.id);
                          return next;
                        })}
                        className="mt-0.5 h-4 w-4 accent-blue-600"
                      />
                      <span className="min-w-0 text-sm text-slate-700">
                        <span className="block font-semibold text-slate-900">{group.records.length} matching records</span>
                        <span className="block truncate">Keep oldest: {oldest.firstName} {oldest.lastName}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {bulkReview && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">Merge {selectedGroups.length} selected duplicate group{selectedGroups.length === 1 ? "" : "s"}?</p>
                  <p className="mt-1">The oldest record in each group will remain. Gifts, activities, tags, consent protections, and linked CRM history move to it. Each group creates an undo record.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setBulkReview(false)} disabled={bulkMerging} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700">Cancel</button>
                    <button type="button" onClick={() => void mergeSelectedGroups()} disabled={bulkMerging} className="rounded-md bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                      {bulkMerging ? "Merging groups…" : "Merge all selected"}
                    </button>
                  </div>
                </div>
              )}
              {bulkError && <p role="alert" className="text-sm text-red-700">{bulkError}</p>}
              {bulkSuccess && <p role="status" className="text-sm text-green-700">{bulkSuccess}</p>}
            </div>
          )}
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
