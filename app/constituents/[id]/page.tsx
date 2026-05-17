"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  formatCurrency,
  formatDate,
  statusColor,
  statusLabel,
  typeLabel,
  engagementColor,
} from "@/app/components/constituents/constituent-utils";
import HouseholdPanel from "@/app/components/constituents/HouseholdPanel";
import QuickGiftModal from "@/app/components/constituents/QuickGiftModal";
import ConstituentNotesTab from "@/app/components/constituents/ConstituentNotesTab";
import ConstituentLettersPanel from "@/app/components/constituents/ConstituentLettersPanel";
import EmailPreferencePanel from "@/app/components/constituents/EmailPreferencePanel";
import DonorStewardSignalsWidget from "@/app/components/steward/DonorStewardSignalsWidget";
import WorkspaceControlRail from "@/app/components/workspace/WorkspaceControlRail";
import WorkspaceFrame from "@/app/components/workspace/WorkspaceFrame";
import type { WorkspaceControlGroup } from "@/app/components/workspace/workspace-types";
import { apiFetch } from "@/app/lib/auth-client";

interface HouseholdData {
  id: string;
  name: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  head?: { id: string; firstName: string; lastName: string; prefix?: string };
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    prefix?: string;
    email?: string;
    phone?: string;
    type: string;
    donorStatus: string;
    isPrimaryContact: boolean;
    totalLifetimeGiving: string;
  }>;
}

interface ConstituentDetail {
  id: string;
  firstName: string;
  lastName: string;
  prefix?: string;
  email?: string;
  email2?: string;
  phone?: string;
  phone2?: string;
  mobile?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  type: string;
  donorStatus: string;
  employer?: string;
  occupation?: string;
  notes?: string;
  totalLifetimeGiving: string;
  totalYtdGiving: string;
  lastGiftDate?: string;
  lastGiftAmount?: string;
  firstGiftDate?: string;
  giftCount: number;
  engagementScore: number;
  createdAt: string;
  doNotEmail: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
  householdId?: string;
  tags: Array<{ tagId: string; tag: { name: string; color: string } }>;
  donations: Array<{
    id: string;
    amount: string;
    date: string;
    paymentMethod: string;
    status: string;
    campaign?: { name: string };
    designation?: { name: string };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    dueDate?: string;
    priority: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user?: { id: string; firstName: string; lastName: string };
  }>;
  // Household where this constituent is the head
  headOf?: HouseholdData;
  // Household this constituent belongs to as a member
  household?: HouseholdData;
}

export default function ConstituentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [constituent, setConstituent] = useState<ConstituentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"giving" | "tasks" | "timeline" | "household" | "notes">("giving");
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [deletingDonationId, setDeletingDonationId] = useState<string | null>(null);

  const isHousehold = constituent?.type === "HOUSEHOLD";

  const tabs = useMemo(() => {
    if (!constituent) {
      return [
        { key: "giving" as const, label: "Giving History" },
        { key: "tasks" as const, label: "Tasks" },
        { key: "timeline" as const, label: "Timeline" },
        { key: "notes" as const, label: "Notes" },
      ];
    }

    return [
      ...(isHousehold ? [{ key: "household" as const, label: `Members (${constituent.headOf?.members?.length ?? 0})` }] : []),
      { key: "giving" as const, label: `Giving History (${constituent.donations?.length ?? 0})` },
      { key: "tasks" as const, label: `Tasks (${constituent.tasks?.length ?? 0})` },
      { key: "timeline" as const, label: `Timeline (${constituent.activities?.length ?? 0})` },
      { key: "notes" as const, label: "Notes" },
    ];
  }, [constituent, isHousehold]);

  const railGroups = useMemo<WorkspaceControlGroup[]>(() => [
    {
      id: "workspace-views",
      label: "Workspace Views",
      items: tabs.map((tabItem) => ({
        id: `view:${tabItem.key}`,
        label: tabItem.label,
        status: "Working",
      })),
    },
    {
      id: "related-workspaces",
      label: "Related Workspaces",
      items: [
        { id: "related:communications", label: "Communications", href: `/communications?source=constituent&constituentId=${id}`, external: true, status: "Working" },
        { id: "related:tasks", label: "Tasks", href: `/tasks?focus=my&constituentId=${id}`, external: true, status: "Working" },
      ],
    },
    {
      id: "quick-actions",
      label: "Quick Actions",
      items: [
        { id: "action:record-gift", label: "Record Gift", status: "Working" },
      ],
    },
  ], [id, tabs]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<ConstituentDetail>(`/api/constituents/${id}`);
        setConstituent(data);
        // Default to household tab for HOUSEHOLD type constituents
        if (data.type === "HOUSEHOLD") setTab("household");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  /** Deletes a donation from this profile and reloads donor details so rollups stay accurate. */
  async function handleDeleteDonation(donationId: string) {
    if (!confirm("Delete this donation record? This cannot be undone.")) return;

    setDeletingDonationId(donationId);
    try {
      await apiFetch(`/api/donations/${donationId}`, { method: "DELETE" });
      const refreshed = await apiFetch<ConstituentDetail>(`/api/constituents/${id}`);
      setConstituent(refreshed);
      setTab("giving");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete donation.");
    } finally {
      setDeletingDonationId(null);
    }
  }

  if (loading) return <LoadingState />;
  if (error || !constituent) return <ErrorState error={error} id={id} />;

  const c = constituent;
  const fullName = `${c.prefix ? c.prefix + " " : ""}${c.firstName} ${c.lastName}`;
  const emailAddresses = [
    c.email ? { label: "Primary", value: c.email } : null,
    c.email2 ? { label: "Secondary", value: c.email2 } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  function handleRailSelect(itemId: string) {
    if (itemId.startsWith("view:")) {
      setTab(itemId.replace("view:", "") as typeof tab);
      return;
    }

    if (itemId === "action:record-gift") {
      setShowGiftModal(true);
    }
  }

  return (
    <WorkspaceFrame
      title={fullName}
      description={`${typeLabel(c.type)} · ${statusLabel(c.donorStatus)}`}
      controlRail={(
        <WorkspaceControlRail
          title="Constituent Controls"
          groups={railGroups}
          activeItem={`view:${tab}`}
          onSelect={handleRailSelect}
        />
      )}
    >
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600 transition-colors">Constituents</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{fullName}</span>
      </nav>

      {/* Profile header */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50 text-xl font-bold text-green-700">
                {isHousehold ? (
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                ) : `${c.firstName[0]}${c.lastName[0]}`}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-xl font-semibold text-gray-950">{fullName}</h1>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(c.donorStatus)}`}>
                    {statusLabel(c.donorStatus)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{typeLabel(c.type)}</span>
                </div>
                {c.employer && <p className="mt-1 text-sm text-gray-600">{c.employer}{c.occupation ? ` · ${c.occupation}` : ""}</p>}
                {c.household && !isHousehold && (
                  <p className="mt-1 text-xs text-gray-500">
                    Member of{" "}
                    <Link href={`/constituents/${c.household.head?.id}`} className="font-semibold text-green-700 hover:underline">
                      {c.household.name}
                    </Link>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.tags.length === 0 ? (
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">No tags</span>
                  ) : c.tags.map((t) => (
                    <span key={t.tagId} className="inline-flex rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: t.tag.color }}>
                      {t.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <ProfileContactPanel
              emails={emailAddresses}
              phone={c.phone}
              mobile={c.mobile}
              location={[c.city, c.state, c.zip].filter(Boolean).join(", ")}
              flags={{ doNotEmail: c.doNotEmail, doNotCall: c.doNotCall, doNotMail: c.doNotMail }}
            />

            <div className="mt-4">
              <EmailPreferencePanel constituentId={id} email={c.email} />
            </div>
          </div>

          <ProfileToolsPanel constituentId={id} onRecordGift={() => setShowGiftModal(true)} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Lifetime Giving" value={formatCurrency(c.totalLifetimeGiving)} />
        <StatCard label="YTD Giving" value={formatCurrency(c.totalYtdGiving)} />
        <StatCard label="Total Gifts" value={`${c.giftCount}`} sub={c.firstGiftDate ? `Since ${formatDate(c.firstGiftDate)}` : undefined} />
        <StatCard
          label="Engagement"
          value={`${c.engagementScore}/100`}
          valueClass={engagementColor(c.engagementScore)}
        />
      </div>

      {/* Steward Signals donor widget shell (read-only until full orchestration rollout). */}
      <DonorStewardSignalsWidget constituentId={id} />

      {/* Constituent-specific letter history and generation shortcut. */}
      <ConstituentLettersPanel constituentId={id} />

      {/* Tabbed detail */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-5">
          {tab === "household" && c.headOf && (
            <HouseholdPanel householdId={c.headOf.id} headConstituentId={c.id} />
          )}
          {tab === "giving" && (
            <GivingTab
              donations={c.donations ?? []}
              onDelete={handleDeleteDonation}
              deletingDonationId={deletingDonationId}
            />
          )}
          {tab === "tasks" && <TasksTab tasks={c.tasks ?? []} />}
          {tab === "timeline" && <TimelineTab activities={c.activities ?? []} />}
          {tab === "notes" && (
            <ConstituentNotesTab
              constituentId={id}
              initialNotes={c.notes ?? ""}
              existingActivities={c.activities ?? []}
            />
          )}
        </div>
      </div>

      {/* Record Gift quick modal */}
      {showGiftModal && (
        <QuickGiftModal
          constituentId={id}
          constituentName={`${c.firstName} ${c.lastName}`}
          onClose={() => setShowGiftModal(false)}
          onSaved={(donation) => {
            // Optimistically prepend the new donation and update lifetime giving
            setConstituent((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                donations: [
                  {
                    id: donation.id,
                    amount: String(donation.amount),
                    date: donation.date,
                    paymentMethod: donation.paymentMethod,
                    status: donation.status,
                    campaign: donation.campaign ?? undefined,
                    designation: donation.designation ?? undefined,
                  },
                  ...(prev.donations ?? []),
                ],
                giftCount: prev.giftCount + 1,
              };
            });
            setShowGiftModal(false);
            setTab("giving");
          }}
        />
      )}

      <p className="text-xs text-gray-400">Record added {formatDate(c.createdAt)}</p>
    </div>
    </WorkspaceFrame>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProfileToolsPanel({ constituentId, onRecordGift }: { constituentId: string; onRecordGift: () => void }) {
  return (
    <aside className="border-t border-gray-200 bg-gray-50 p-4 sm:p-5 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile Tools</p>
          <h2 className="text-sm font-semibold text-gray-950">Work with this constituent</h2>
        </div>
        <Link
          href={`/constituents/${constituentId}/edit`}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          Edit
        </Link>
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onRecordGift}
          className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Record Gift
        </button>
        <Link href={`/letters-printables/generate?constituentId=${constituentId}`} className={PROFILE_TOOL_LINK_CLS}>
          Generate Letter
        </Link>
        <Link href={`/communications?new=1&source=constituent&constituentId=${constituentId}`} className={PROFILE_TOOL_LINK_CLS}>
          Create Communication
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/tasks?focus=my&constituentId=${constituentId}`} className={PROFILE_TOOL_LINK_CLS}>
            Task
          </Link>
          <Link href={`/meetings?constituentId=${constituentId}`} className={PROFILE_TOOL_LINK_CLS}>
            Meeting
          </Link>
        </div>
        <Link href={`/automations?source=constituent&constituentId=${constituentId}`} className={PROFILE_TOOL_LINK_CLS}>
          Start Steward Path
        </Link>
      </div>
    </aside>
  );
}

function ProfileContactPanel({
  emails,
  phone,
  mobile,
  location,
  flags,
}: {
  emails: Array<{ label: string; value: string }>;
  phone?: string;
  mobile?: string;
  location?: string;
  flags: { doNotEmail: boolean; doNotCall: boolean; doNotMail: boolean };
}) {
  const hasFlags = flags.doNotEmail || flags.doNotCall || flags.doNotMail;
  return (
    <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email Addresses</p>
          <div className="mt-2 space-y-2">
            {emails.length === 0 ? (
              <p className="text-sm text-gray-500">No email addresses on profile.</p>
            ) : emails.map((email) => (
              <div key={`${email.label}:${email.value}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{email.label}</p>
                  <a href={`mailto:${email.value}`} className="block truncate text-sm font-medium text-green-700 hover:underline">{email.value}</a>
                </div>
                {email.label === "Primary" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Default</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 text-sm">
          {phone && <ContactDetail label="Phone" value={phone} href={`tel:${phone}`} />}
          {mobile && <ContactDetail label="Mobile" value={mobile} href={`tel:${mobile}`} />}
          {location && <ContactDetail label="Location" value={location} />}
          {hasFlags && (
            <div className="flex flex-wrap gap-2">
              {flags.doNotEmail && <Flag label="Do Not Email" />}
              {flags.doNotCall && <Flag label="Do Not Call" />}
              {flags.doNotMail && <Flag label="Do Not Mail" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GivingTab({
  donations,
  onDelete,
  deletingDonationId,
}: {
  donations: ConstituentDetail["donations"];
  onDelete?: (donationId: string) => void;
  deletingDonationId?: string | null;
}) {
  if (!donations.length) return <p className="text-sm text-gray-400 italic">No donations recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["Date", "Amount", "Campaign", "Fund", "Method", "Status", "Actions"].map((h) => (
              <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {donations.map((d) => (
            <tr key={d.id}>
              <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{formatDate(d.date)}</td>
              <td className="py-2 pr-4 font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(d.amount)}</td>
              <td className="py-2 pr-4 text-gray-600">{d.campaign?.name ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-600">{d.designation?.name ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-500 capitalize whitespace-nowrap">{d.paymentMethod.replace("_", " ").toLowerCase()}</td>
              <td className="py-2 pr-4">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  d.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {d.status.toLowerCase()}
                </span>
              </td>
              <td className="py-2 pr-4">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(d.id)}
                    disabled={deletingDonationId === d.id}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60 transition-colors"
                    title="Delete donation"
                  >
                    {deletingDonationId === d.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TasksTab({ tasks }: { tasks: ConstituentDetail["tasks"] }) {
  if (!tasks.length) return <p className="text-sm text-gray-400 italic">No tasks linked to this constituent.</p>;
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <p className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-900"}`}>
              {t.title}
            </p>
            <p className="text-xs text-gray-400">{t.type} · Due {formatDate(t.dueDate)}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            t.priority === "HIGH" ? "bg-red-100 text-red-700" :
            t.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" :
            "bg-gray-100 text-gray-600"
          }`}>
            {t.priority.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ activities }: { activities: ConstituentDetail["activities"] }) {
  if (!activities.length) return <p className="text-sm text-gray-400 italic">No timeline events yet.</p>;
  return (
    <div className="space-y-3">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-2 shrink-0" />
          <div>
            <p className="text-sm text-gray-900">{a.description}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(a.createdAt)}
              {a.user && ` · ${a.user.firstName} ${a.user.lastName}`}
              {` · ${a.type.toLowerCase().replace("_", " ")}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ContactDetail({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {href ? (
        <a href={href} className="block truncate font-medium text-green-700 hover:underline">{value}</a>
      ) : (
        <p className="truncate font-medium text-gray-800">{value}</p>
      )}
    </div>
  );
}

function Flag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
      {label}
    </span>
  );
}

const PROFILE_TOOL_LINK_CLS = "inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100";

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, id }: { error: string | null; id: string }) {
  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600">Constituents</Link> / <span className="text-gray-900">Not Found</span>
      </nav>
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-2xl mb-2">👤</p>
        <h2 className="text-lg font-semibold text-gray-700">Constituent not found</h2>
        <p className="text-sm text-gray-400 mt-1">{error ?? `No record with ID: ${id}`}</p>
        <Link href="/constituents" className="mt-4 inline-flex px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          Back to Constituents
        </Link>
      </div>
    </div>
  );
}
