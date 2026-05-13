/**
 * /grants/[id] — Grant case-file workspace page.
 * Multi-tab layout for overview, research notes, requirements, reminders,
 * writing tasks, resources, submission/decision tracking, and activity timeline.
 * Supports inline status updates and editing via AddGrantModal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import GrantWritingPanel from "@/app/components/grants/GrantWritingPanel";
import GrantActivityFeed from "@/app/components/grants/GrantActivityFeed";
import GrantCaseItemPanel from "@/app/components/grants/GrantCaseItemPanel";
import AddGrantModal from "@/app/components/grants/AddGrantModal";
import type { Grant, GrantActivity, GrantSection, GrantStatus } from "@/app/components/grants/types";
import { STATUS_META, PIPELINE_STAGES, TERMINAL_STAGES, fmt$, fmtDate } from "@/app/components/grants/types";

type Tab = "overview" | "research" | "requirements" | "reminders" | "tasks" | "resources" | "writing" | "decision" | "activity";

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
        <optgroup label="In Progress">
          {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </optgroup>
        <optgroup label="Decision / Closed">
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

/** Builds a donation-new link that keeps award recording in Donations, not Grants. */
function buildGrantReceivedHref(grant: Grant): string {
  const params = new URLSearchParams({
    source: "grant-award",
    grantId: grant.id,
    grantTitle: grant.title,
    funderName: grant.funder?.name ?? "",
    suggestedAmount: String(Number(grant.amountAwarded ?? 0) || Number(grant.amountRequested ?? 0) || ""),
  });
  return `/donations/new?${params.toString()}`;
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

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Grant Workspace Boundary</p>
        <p className="mt-1 text-sm text-blue-900">
          This record tracks research, writing, deadlines, requirements, and follow-up planning. Received award money is recorded separately in Donations.
        </p>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-max">
        {([
          { key: "overview", label: "Overview" },
          { key: "research", label: "Research" },
          { key: "requirements", label: "Requirements" },
          { key: "reminders", label: "Reminders" },
          { key: "tasks", label: "Writing Tasks" },
          { key: "resources", label: "Resources" },
          { key: "writing", label: `Writing ${completedSections > 0 ? `(${completedSections}/${sections.length})` : ""}`.trim() },
          { key: "decision", label: "Decision" },
          { key: "activity", label: "Activity" },
        ] as { key: Tab; label: string }[]).map((tabDef) => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === tabDef.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tabDef.label}
          </button>
        ))}
        </div>
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

      {/* ── Research tab ── */}
      {tab === "research" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Research Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{grant.notes?.trim() || "No research notes recorded yet."}</p>
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Eligibility / Internal Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{grant.internalNotes?.trim() || "No eligibility or internal notes recorded yet."}</p>
          </section>
        </div>
      )}

      {/* ── Requirements tab ── */}
      {tab === "requirements" && (
        <GrantCaseItemPanel
          grantId={grantId}
          kind="REQUIREMENT"
          heading="Grant Requirements"
          emptyMessage="No requirements added yet. Capture required application items here."
        />
      )}

      {/* ── Reminders tab ── */}
      {tab === "reminders" && (
        <GrantCaseItemPanel
          grantId={grantId}
          kind="REMINDER"
          heading="Grant Reminders"
          emptyMessage="No reminders scheduled yet. Add draft, review, submission, and report reminders."
        />
      )}

      {/* ── Tasks tab ── */}
      {tab === "tasks" && (
        <GrantCaseItemPanel
          grantId={grantId}
          kind="TASK"
          heading="Grant Tasks"
          emptyMessage="No grant writing tasks yet. Add research, writing, review, and submission tasks."
        />
      )}

      {/* ── Resources tab ── */}
      {tab === "resources" && (
        <GrantCaseItemPanel
          grantId={grantId}
          kind="RESOURCE"
          heading="Grant Resources"
          emptyMessage="No resources linked yet. Add portal links, guidelines, drive folders, and references."
        />
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

      {/* ── Decision tab ── */}
      {tab === "decision" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Decision Snapshot</h2>
            <dl className="space-y-2">
              <DetailRow label="Current Status" value={STATUS_META[grant.status].label} />
              <DetailRow label="Submitted" value={fmtDate(grant.submittedAt)} />
              <DetailRow label="Decision Date" value={fmtDate(grant.awardedAt ?? grant.rejectedAt)} />
              <DetailRow label="Awarded Amount" value={fmt$(grant.amountAwarded)} />
            </dl>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Record Award In Donations</h2>
            <p className="text-sm text-gray-600">
              Keep financial source-of-truth in Donations. This grant case file does not automatically create donation ledger entries.
            </p>
            <Link
              href={buildGrantReceivedHref(grant)}
              className="inline-flex rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Record Award As Received Grant
            </Link>
          </section>
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
