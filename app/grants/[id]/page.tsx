/**
 * /grants/[id] — Grant detail page.
 * Three-tab layout: Overview, Writing workspace, Activity timeline.
 * Supports inline status updates and editing via AddGrantModal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import GrantWritingPanel from "@/app/components/grants/GrantWritingPanel";
import GrantActivityFeed from "@/app/components/grants/GrantActivityFeed";
import AddGrantModal from "@/app/components/grants/AddGrantModal";
import type { Grant, GrantActivity, GrantSection, GrantStatus } from "@/app/components/grants/types";
import { STATUS_META, PIPELINE_STAGES, TERMINAL_STAGES, fmt$, fmtDate } from "@/app/components/grants/types";

type Tab = "overview" | "writing" | "activity";

/** Inline status selector — PATCH on change. */
function StatusSelector({ grant, onUpdated }: { grant: Grant; onUpdated: (g: Grant) => void }) {
  const [changing, setChanging] = useState(false);
  const meta = STATUS_META[grant.status];

  async function handleChange(status: GrantStatus) {
    if (status === grant.status) return;
    setChanging(true);
    try {
      const updated = await apiFetch<Grant>(`/api/grants/${grant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onUpdated(updated);
    } catch { /* silent */ } finally {
      setChanging(false);
    }
  }

  return (
    <div className="relative">
      <select
        value={grant.status}
        onChange={(e) => handleChange(e.target.value as GrantStatus)}
        disabled={changing}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none
          ${meta.bg} ${meta.color} ${meta.border} disabled:opacity-60`}
      >
        <optgroup label="Active">
          {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </optgroup>
        <optgroup label="Outcome">
          {TERMINAL_STAGES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

/** Detail row in the overview tab. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex gap-4">
      <dt className="text-xs font-medium text-gray-400 w-36 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

/** GrantDetailPage — main grant detail view. */
export default function GrantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const grantId = params.id;

  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Grant>(`/api/grants/${grantId}`);
      setGrant(data);
    } catch { router.push("/grants"); } finally {
      setLoading(false);
    }
  }, [grantId, router]);

  useEffect(() => { load(); }, [load]);

  /** Handle section content/completion changes from the writing panel. */
  function handleSectionsChange(sections: GrantSection[]) {
    setGrant((g) => g ? { ...g, sections } : g);
  }

  /** Handle a new activity being added. */
  function handleActivityAdded(a: GrantActivity) {
    setGrant((g) => g ? { ...g, activities: [a, ...(g.activities ?? [])] } : g);
  }

  if (loading || !grant) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const sections = grant.sections ?? [];
  const activities = grant.activities ?? [];
  const completedSections = sections.filter((s) => s.completed).length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 flex items-center gap-1.5">
        <Link href="/grants" className="hover:text-green-600">Grants</Link>
        <span>/</span>
        <span className="text-gray-700">{grant.title}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{grant.title}</h1>
            <p className="text-sm text-gray-500">
              {grant.funder?.name ?? "Unknown funder"}
              {grant.programArea ? ` · ${grant.programArea}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusSelector grant={grant} onUpdated={setGrant} />
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Requested</p>
            <p className="text-base font-semibold text-gray-900">{fmt$(grant.amountRequested)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Awarded</p>
            <p className="text-base font-semibold text-green-700">{fmt$(grant.amountAwarded)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Deadline</p>
            <p className="text-base font-semibold text-gray-900">{fmtDate(grant.applicationDeadline)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Writing Progress</p>
            <p className="text-base font-semibold text-gray-900">
              {sections.length > 0 ? `${completedSections}/${sections.length}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["overview", "writing", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "writing" ? `Writing ${completedSections > 0 ? `(${completedSections}/${sections.length})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dates & deadlines */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Dates & Deadlines</h2>
            <dl className="space-y-2">
              <DetailRow label="LOI Deadline" value={fmtDate(grant.loiDeadline)} />
              <DetailRow label="LOI Submitted" value={fmtDate(grant.loiSubmittedAt)} />
              <DetailRow label="Application Deadline" value={fmtDate(grant.applicationDeadline)} />
              <DetailRow label="Submitted" value={fmtDate(grant.submittedAt)} />
              <DetailRow label="Awarded" value={fmtDate(grant.awardedAt)} />
              <DetailRow label="Grant Period" value={
                grant.grantPeriodStart
                  ? `${fmtDate(grant.grantPeriodStart)} – ${fmtDate(grant.grantPeriodEnd)}`
                  : null
              } />
              <DetailRow label="Report Deadline" value={fmtDate(grant.reportingDeadline)} />
              <DetailRow label="Report Submitted" value={fmtDate(grant.reportingSubmittedAt)} />
            </dl>
          </div>

          {/* Grant details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Grant Details</h2>
            <dl className="space-y-2">
              <DetailRow label="Assignee" value={
                grant.assignee
                  ? `${grant.assignee.firstName} ${grant.assignee.lastName}`
                  : null
              } />
              <DetailRow label="Program Area" value={grant.programArea} />
              <DetailRow label="Requires LOI" value={grant.requiresLOI ? "Yes" : null} />
              <DetailRow label="Notes" value={grant.notes} />
              <DetailRow label="Internal Notes" value={grant.internalNotes} />
            </dl>
          </div>
        </div>
      )}

      {/* ── Writing tab ── */}
      {tab === "writing" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sections.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              No writing sections found. Sections are created automatically when a grant is added.
            </div>
          ) : (
            <GrantWritingPanel
              grantId={grantId}
              sections={sections}
              onSectionsChange={handleSectionsChange}
            />
          )}
        </div>
      )}

      {/* ── Activity tab ── */}
      {tab === "activity" && (
        <GrantActivityFeed
          grantId={grantId}
          activities={activities}
          onActivityAdded={handleActivityAdded}
        />
      )}

      {/* Edit modal */}
      {showEdit && (
        <AddGrantModal
          grant={grant}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setGrant(updated);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
