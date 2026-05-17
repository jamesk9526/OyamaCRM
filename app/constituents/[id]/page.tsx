// Constituent profile page — enterprise relationship command center layout.
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
import StewardContextButton from "@/app/components/ai/StewardContextButton";
import WorkspaceFrame from "@/app/components/workspace/WorkspaceFrame";
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
  doNotContact: boolean;
  emailOptOut: boolean;
  householdId?: string;
  tags: Array<{ tagId: string; tag: { name: string; color: string } }>;
  donations: Array<{
    id: string;
    amount: string;
    date: string;
    paymentMethod: string;
    status: string;
    receiptSentAt?: string | null;
    acknowledgmentSentAt?: string | null;
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
  headOf?: HouseholdData;
  household?: HouseholdData;
}

type TabKey =
  | "overview"
  | "giving"
  | "tasks"
  | "timeline"
  | "communications"
  | "household"
  | "notes"
  | "files"
  | "audit";

export default function ConstituentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [constituent, setConstituent] = useState<ConstituentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [deletingDonationId, setDeletingDonationId] = useState<string | null>(null);

  const isHousehold = constituent?.type === "HOUSEHOLD";

  const tabs = useMemo(() => {
    if (!constituent) return [] as Array<{ key: TabKey; label: string; count?: number }>;
    return [
      { key: "overview" as TabKey, label: "Overview" },
      ...(isHousehold ? [{ key: "household" as TabKey, label: "Members", count: constituent.headOf?.members?.length }] : []),
      { key: "giving" as TabKey, label: "Giving", count: constituent.donations?.length },
      { key: "communications" as TabKey, label: "Communications" },
      { key: "tasks" as TabKey, label: "Tasks", count: constituent.tasks?.length },
      { key: "timeline" as TabKey, label: "Timeline", count: constituent.activities?.length },
      { key: "notes" as TabKey, label: "Notes" },
      { key: "files" as TabKey, label: "Files" },
      { key: "audit" as TabKey, label: "Audit" },
    ];
  }, [constituent, isHousehold]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<ConstituentDetail>(`/api/constituents/${id}`);
        setConstituent(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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

  // Derived identity
  const fullName = `${c.prefix ? c.prefix + " " : ""}${c.firstName ?? ""}${c.lastName ? " " + c.lastName : ""}`.trim();
  const initials = isHousehold
    ? ""
    : `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const locationSummary = [c.city, c.state, c.zip].filter(Boolean).join(", ");
  const primaryPhone = c.phone ?? c.mobile ?? c.phone2;

  // Giving analytics
  const avgGift = c.giftCount > 0 ? Number(c.totalLifetimeGiving) / c.giftCount : 0;
  const largestGift = c.donations.reduce((max, g) => Math.max(max, Number(g.amount ?? 0)), 0);
  const openTasks = c.tasks.filter((t) => t.status !== "COMPLETED");
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  const daysSinceLastGift = c.lastGiftDate
    ? Math.floor((Date.now() - new Date(c.lastGiftDate).getTime()) / 86400000)
    : null;
  const lapseRisk = c.doNotContact
    ? "Restricted"
    : daysSinceLastGift == null
      ? "Unknown"
      : daysSinceLastGift > 120
        ? "High"
        : daysSinceLastGift > 75
          ? "Medium"
          : "Low";
  const opportunityScore = Math.max(0, Math.min(100,
    Math.round((c.engagementScore * 0.65) + (Math.min(c.giftCount, 20) * 1.75))
  ));

  // Communication flags
  const commRestrictions: string[] = [
    ...(c.doNotContact ? ["Do Not Contact"] : []),
    ...(c.doNotEmail ? ["Do Not Email"] : []),
    ...(c.emailOptOut ? ["Email Opt-Out"] : []),
    ...(c.doNotCall ? ["Do Not Call"] : []),
    ...(c.doNotMail ? ["Do Not Mail"] : []),
  ];

  // Giving cadence
  const giftIntervals = c.donations
    .slice(0, 6).map((g) => new Date(g.date).getTime()).filter(Number.isFinite)
    .sort((a, b) => b - a).slice(0, 5)
    .map((v, i, arr) => i < arr.length - 1 ? Math.round((arr[i] - arr[i + 1]) / 86400000) : null)
    .filter((v): v is number => v != null && v > 0);
  const cadenceDays = giftIntervals.length > 0
    ? Math.round(giftIntervals.reduce((s, v) => s + v, 0) / giftIntervals.length)
    : null;

  const nextBestActionTitle = c.doNotContact
    ? "Respect contact restriction"
    : (c.doNotEmail || c.emailOptOut)
      ? "Create a phone or mail follow-up"
      : (c.giftCount > 0 && daysSinceLastGift != null && daysSinceLastGift > 45)
        ? "Send a personal reconnect email"
        : openTasks.length > 0
          ? "Complete outstanding stewardship tasks"
          : "Create a proactive stewardship touchpoint";

  const nextBestActionWhy = c.doNotContact
    ? "Profile is marked Do Not Contact. Staff should review permissions before any outreach."
    : (c.doNotEmail || c.emailOptOut)
      ? "Email outreach is restricted. Phone or mail is safer until preferences are updated."
      : c.lastGiftDate
        ? `Last gift was ${formatDate(c.lastGiftDate)} — lapse risk is ${lapseRisk.toLowerCase()}.`
        : "No gift activity recorded yet; relationship qualification should be prioritized.";

  const dataQualityWarnings = [
    !c.email ? "Missing primary email" : null,
    !primaryPhone ? "Missing phone number" : null,
    !locationSummary ? "Missing mailing address" : null,
    !c.tags.length ? "No tags assigned" : null,
    !c.household && !isHousehold ? "No household relationship linked" : null,
    c.giftCount > 0 && !openTasks.length ? "No open stewardship task after giving activity" : null,
  ].filter((w): w is string => w != null);

  const lapseRiskColor =
    lapseRisk === "High" || lapseRisk === "Restricted" ? "text-red-600" :
    lapseRisk === "Medium" ? "text-amber-600" :
    lapseRisk === "Low" ? "text-emerald-600" : "text-gray-500";

  return (
    <WorkspaceFrame
      title={fullName}
      description={`${typeLabel(c.type)} · ${statusLabel(c.donorStatus)}`}
    >
      <div className="space-y-4 pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/constituents" className="hover:text-emerald-600 transition-colors">Constituents</Link>
          <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
          <span className="font-medium text-gray-900 truncate">{fullName}</span>
        </nav>

        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {commRestrictions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-red-50 border-b border-red-200 px-5 py-2.5">
              <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Communication Restricted</span>
              <span className="text-red-300">·</span>
              {commRestrictions.map((r) => (
                <span key={r} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">{r}</span>
              ))}
            </div>
          )}

          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              {/* Avatar + Identity */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold select-none ${isHousehold ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"}`}>
                  {isHousehold ? (
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  ) : <span>{initials}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-950 leading-tight">{fullName}</h1>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(c.donorStatus)}`}>
                      {statusLabel(c.donorStatus)}
                    </span>
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                      {typeLabel(c.type)}
                    </span>
                  </div>

                  {(c.employer || c.occupation) && (
                    <p className="mt-1 text-sm text-gray-500">{[c.employer, c.occupation].filter(Boolean).join(" · ")}</p>
                  )}
                  {c.household && !isHousehold && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Member of{" "}
                      <Link href={`/constituents/${c.household.head?.id}`} className="font-semibold text-emerald-700 hover:underline">
                        {c.household.name}
                      </Link>
                    </p>
                  )}

                  {/* Contact line */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-gray-600 hover:text-emerald-700 transition-colors">
                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No email on file</span>
                    )}
                    {primaryPhone ? (
                      <a href={`tel:${primaryPhone}`} className="flex items-center gap-1.5 text-gray-600 hover:text-emerald-700 transition-colors">
                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        {primaryPhone}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No phone on file</span>
                    )}
                    {locationSummary && (
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        {locationSummary}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {c.tags.length === 0 ? (
                      <span className="text-xs text-gray-400">No tags assigned</span>
                    ) : c.tags.map((t) => (
                      <span key={t.tagId} className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: t.tag.color }}>
                        {t.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:items-stretch lg:min-w-[148px]">
                <button
                  type="button"
                  onClick={() => setShowGiftModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  Record Gift
                </button>
                <Link href={`/communications?new=1&source=constituent&constituentId=${id}`} className={QA_BTN}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Draft Email
                </Link>
                <Link href={`/letters-printables/generate?constituentId=${id}`} className={QA_BTN}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Create Letter
                </Link>
                <Link href={`/tasks?focus=my&constituentId=${id}`} className={QA_BTN}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  Create Task
                </Link>
                <Link href={`/constituents/${id}/edit`} className={QA_BTN}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Edit Profile
                </Link>
              </div>
            </div>

            {/* Steward AI chips */}
            <div className="mt-4 border-t border-gray-100 pt-3 flex flex-wrap gap-1.5">
              <StewardContextButton label="Summarize donor" prompt={`Summarize ${fullName}'s full donor relationship. Include giving history, engagement signals, communication constraints, and what staff should do next.`} moduleKey="donor" mode="ask" variant="chip" />
              <StewardContextButton label="Why at risk?" prompt={`Why is ${fullName} currently at risk? Use giving cadence, last gift timing, open tasks, and communication preferences.`} moduleKey="donor" mode="analyze" variant="chip" />
              <StewardContextButton label="Draft thank-you" prompt={`Draft a personal thank-you email for ${fullName} referencing their giving history. Keep it warm and concise.`} moduleKey="donor" mode="draft" variant="chip" />
              <StewardContextButton label="Call script" prompt={`Create a short call script for staff to reconnect with ${fullName}. Include opening, appreciation, discovery question, and next-step ask.`} moduleKey="donor" mode="action" variant="chip" />
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Lifetime Giving" value={formatCurrency(c.totalLifetimeGiving)} onClick={() => setTab("giving")} />
          <KpiCard label="YTD Giving" value={formatCurrency(c.totalYtdGiving)} onClick={() => setTab("giving")} />
          <KpiCard label="Last Gift" value={c.lastGiftAmount ? formatCurrency(c.lastGiftAmount) : "—"} sub={c.lastGiftDate ? formatDate(c.lastGiftDate) : undefined} onClick={() => setTab("giving")} />
          <KpiCard label="Gift Count" value={String(c.giftCount)} sub={c.firstGiftDate ? `Since ${formatDate(c.firstGiftDate)}` : undefined} onClick={() => setTab("giving")} />
          <KpiCard label="Open Tasks" value={String(openTasks.length)} sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : undefined} subColor={overdueTasks.length > 0 ? "text-red-600" : undefined} onClick={() => setTab("tasks")} />
          <KpiCard label="Average Gift" value={formatCurrency(avgGift)} onClick={() => setTab("giving")} />
          <KpiCard label="Largest Gift" value={formatCurrency(largestGift)} onClick={() => setTab("giving")} />
          <KpiCard label="First Gift" value={c.firstGiftDate ? formatDate(c.firstGiftDate) : "—"} onClick={() => setTab("giving")} />
          <KpiCard label="Lapse Risk" value={lapseRisk} valueColor={lapseRiskColor} onClick={() => setTab("overview")} />
          <KpiCard label="Opportunity" value={`${opportunityScore}/100`} valueColor={engagementColor(opportunityScore)} onClick={() => setTab("overview")} />
        </div>

        {/* Two-column main content */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left: Tabbed workspace */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab navigation */}
            <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50 scrollbar-hide">
              {tabs.map((tabItem) => {
                const isActive = tab === tabItem.key;
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setTab(tabItem.key)}
                    className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${
                      isActive
                        ? "text-emerald-700 border-b-2 border-emerald-600 -mb-px bg-white"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
                    }`}
                  >
                    {tabItem.label}
                    {tabItem.count != null && tabItem.count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                        {tabItem.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-5">
              {tab === "overview" && (
                <OverviewTab
                  constituent={c}
                  fullName={fullName}
                  cadenceDays={cadenceDays}
                  daysSinceLastGift={daysSinceLastGift}
                  openTasks={openTasks}
                  onSwitchTab={setTab}
                />
              )}
              {tab === "household" && c.headOf && (
                <HouseholdPanel householdId={c.headOf.id} headConstituentId={c.id} />
              )}
              {tab === "giving" && (
                <GivingTab
                  donations={c.donations ?? []}
                  onDelete={handleDeleteDonation}
                  deletingDonationId={deletingDonationId}
                  constituentId={id}
                  onRecordGift={() => setShowGiftModal(true)}
                />
              )}
              {tab === "communications" && (
                <CommunicationsTab
                  activities={c.activities ?? []}
                  doNotEmail={c.doNotEmail}
                  doNotContact={c.doNotContact}
                  emailOptOut={c.emailOptOut}
                  constituentId={id}
                />
              )}
              {tab === "tasks" && <TasksTab tasks={c.tasks ?? []} constituentId={id} />}
              {tab === "timeline" && <TimelineTab activities={c.activities ?? []} />}
              {tab === "notes" && (
                <ConstituentNotesTab constituentId={id} initialNotes={c.notes ?? ""} existingActivities={c.activities ?? []} />
              )}
              {tab === "files" && <InDevTab title="File Vault" description="File vault is being wired to constituent-scoped document storage." />}
              {tab === "audit" && <InDevTab title="Audit Log" description="Profile-level change log is in development for complete relationship audit visibility." />}
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4">
            <DonorStewardSignalsWidget constituentId={id} />

            {/* Next Best Action */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Next Best Action</h3>
              </div>
              <p className="text-sm font-semibold text-gray-900">{nextBestActionTitle}</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{nextBestActionWhy}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StewardContextButton label="Draft Follow-up" prompt={`For ${fullName}: ${nextBestActionTitle}. Reason: ${nextBestActionWhy}. Draft the exact next outreach or task.`} moduleKey="donor" mode="draft" variant="mini" />
                <Link href={`/tasks?focus=my&constituentId=${id}`} className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Create Task
                </Link>
              </div>
            </div>

            {/* Data Quality */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${dataQualityWarnings.length === 0 ? "bg-emerald-100" : "bg-amber-100"}`}>
                  {dataQualityWarnings.length === 0 ? (
                    <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  )}
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Data Quality</h3>
              </div>
              {dataQualityWarnings.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">All quality checks passed.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dataQualityWarnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      <svg className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* Below-fold panels */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ConstituentLettersPanel constituentId={id} />
          <EmailPreferencePanel constituentId={id} email={c.email} />
        </div>

        {showGiftModal && (
          <QuickGiftModal
            constituentId={id}
            constituentName={`${c.firstName} ${c.lastName}`}
            onClose={() => setShowGiftModal(false)}
            onSaved={(donation) => {
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

        <p className="text-xs text-gray-400">Record created {formatDate(c.createdAt)}</p>
      </div>
    </WorkspaceFrame>
  );
}

// ─── Shared style constants ───────────────────────────────────────────────────

const QA_BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm";
const ACTION_BTN = "inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueColor,
  subColor,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  subColor?: string;
  onClick?: () => void;
}) {
  const base = "rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-all hover:border-emerald-300 hover:shadow-sm";
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold leading-none ${valueColor ?? "text-gray-950"}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${subColor ?? "text-gray-400"}`}>{sub}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={base}>{content}</button>
  ) : (
    <div className={base}>{content}</div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  constituent: c,
  fullName,
  cadenceDays,
  daysSinceLastGift,
  openTasks,
  onSwitchTab,
}: {
  constituent: ConstituentDetail;
  fullName: string;
  cadenceDays: number | null;
  daysSinceLastGift: number | null;
  openTasks: ConstituentDetail["tasks"];
  onSwitchTab: (tab: TabKey) => void;
}) {
  const recentGifts = c.donations.slice(0, 5);
  const recentTasks = openTasks.slice(0, 3);
  const recentActivity = c.activities.slice(0, 5);
  const householdLabel = c.headOf?.name ?? c.household?.name;

  const lapseRisk = c.lastGiftDate
    ? Math.floor((Date.now() - new Date(c.lastGiftDate).getTime()) / 86400000) > 120 ? "high" : "low"
    : "unknown";

  const summary =
    c.giftCount === 0
      ? `${fullName} has not given yet. Steward recommends a qualification touchpoint to confirm mission fit, preferred channel, and next ask timing.`
      : `${fullName} has given ${c.giftCount} time${c.giftCount === 1 ? "" : "s"} with ${formatCurrency(c.totalLifetimeGiving)} in lifetime giving.${c.lastGiftDate ? ` Last gift was ${formatCurrency(c.lastGiftAmount)} on ${formatDate(c.lastGiftDate)}.` : ""}${cadenceDays ? ` Typical giving rhythm is about every ${Math.max(30, cadenceDays - 10)}–${cadenceDays + 10} days.` : " Giving cadence is still forming."}${daysSinceLastGift && cadenceDays && daysSinceLastGift > cadenceDays + 15 ? ` They are now ${daysSinceLastGift - cadenceDays} days past their usual cadence.` : ""}${openTasks.length > 0 ? ` ${openTasks.length} open stewardship task${openTasks.length === 1 ? "" : "s"} need follow-up.` : " No open stewardship tasks."}`;

  return (
    <div className="space-y-4">
      {/* Relationship summary */}
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1.5">Relationship Summary</p>
        <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <OverviewSection title="Recent Giving" onViewAll={() => onSwitchTab("giving")} empty={recentGifts.length === 0} emptyText="No gifts recorded yet.">
          <div className="divide-y divide-gray-50">
            {recentGifts.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-500">{formatDate(g.date)}</span>
                <div className="flex items-center gap-2">
                  {g.campaign?.name && <span className="text-xs text-gray-400 truncate max-w-[100px]">{g.campaign.name}</span>}
                  <span className="font-semibold text-gray-900">{formatCurrency(g.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </OverviewSection>

        <OverviewSection title="Open Tasks" onViewAll={() => onSwitchTab("tasks")} empty={recentTasks.length === 0} emptyText="No open tasks currently assigned.">
          <div className="space-y-2">
            {recentTasks.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
              return (
                <div key={t.id} className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 ${overdue ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50"}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>Due {formatDate(t.dueDate)}{overdue ? " · Overdue" : ""}</p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </div>
              );
            })}
          </div>
        </OverviewSection>

        <OverviewSection title="Recent Activity" onViewAll={() => onSwitchTab("timeline")} empty={recentActivity.length === 0} emptyText="No relationship activity yet.">
          <div className="space-y-2">
            {recentActivity.map((a) => (
              <div key={a.id} className="flex gap-2.5 pb-2 border-b border-gray-50 last:border-0">
                <ActivityDot type={a.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 leading-snug">{a.description}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(a.createdAt)}{a.user ? ` · ${a.user.firstName} ${a.user.lastName}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </OverviewSection>

        <OverviewSection title="Household & Notes" empty={false}>
          {householdLabel ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Household</span>
                <span className="font-medium text-gray-900 truncate ml-2">{householdLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Members</span>
                <span className="font-medium text-gray-900">{c.headOf?.members?.length ?? c.household?.members?.length ?? 0}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No household linked.</p>
          )}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Notes</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              {c.notes ? c.notes.slice(0, 200) + (c.notes.length > 200 ? "…" : "") : "No notes captured yet."}
            </p>
          </div>
        </OverviewSection>
      </div>
    </div>
  );
}

function OverviewSection({
  title,
  onViewAll,
  empty,
  emptyText,
  children,
}: {
  title: string;
  onViewAll?: () => void;
  empty: boolean;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
            View all
          </button>
        )}
      </div>
      {empty ? <p className="text-xs text-gray-400 italic">{emptyText}</p> : children}
    </div>
  );
}

// ─── Giving Tab ───────────────────────────────────────────────────────────────

function GivingTab({
  donations,
  onDelete,
  deletingDonationId,
  constituentId,
  onRecordGift,
}: {
  donations: ConstituentDetail["donations"];
  onDelete?: (id: string) => void;
  deletingDonationId?: string | null;
  constituentId: string;
  onRecordGift: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Giving History</h3>
        <button type="button" onClick={onRecordGift} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Record Gift
        </button>
      </div>

      {donations.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          title="No donations recorded"
          description="Record this constituent's first gift to start their giving history."
          action={<button type="button" onClick={onRecordGift} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Record First Gift</button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Date", "Amount", "Campaign", "Fund", "Method", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:pl-4 last:pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {donations.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2.5 pl-4 text-gray-600 whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(d.amount)}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[160px] truncate">{d.campaign?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{d.designation?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 capitalize whitespace-nowrap">{d.paymentMethod.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {d.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 pr-4">
                    {onDelete && (
                      <button type="button" onClick={() => onDelete(d.id)} disabled={deletingDonationId === d.id} className="rounded border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                        {deletingDonationId === d.id ? "…" : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ tasks, constituentId }: { tasks: ConstituentDetail["tasks"]; constituentId: string }) {
  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const done = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Tasks
          {open.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{open.length} open</span>}
        </h3>
        <Link href={`/tasks?focus=my&constituentId=${constituentId}`} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Create Task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
          title="No tasks linked"
          description="Create a task to assign stewardship follow-up to this constituent."
        />
      ) : (
        <div className="space-y-2">
          {open.map((t) => {
            const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
            return (
              <div key={t.id} className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${overdue ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                    {t.type.replace(/_/g, " ").toLowerCase()} · due {formatDate(t.dueDate)}{overdue ? " · OVERDUE" : ""}
                  </p>
                </div>
                <PriorityBadge priority={t.priority} />
              </div>
            );
          })}
          {done.length > 0 && (
            <>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Completed ({done.length})</p>
              {done.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-2.5 opacity-60">
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  <p className="text-sm text-gray-500 line-through">{t.title}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ activities }: { activities: ConstituentDetail["activities"] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        title="No timeline events"
        description="Activities, communications, and notes will appear here as they are recorded."
      />
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((a, idx) => (
        <div key={a.id} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <ActivityDot type={a.type} />
            {idx < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
          </div>
          <div className="flex-1 pb-1 min-w-0">
            <p className="text-sm text-gray-800 leading-snug">{a.description}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {formatDate(a.createdAt)}{a.user ? ` · ${a.user.firstName} ${a.user.lastName}` : ""}{" · "}<span className="capitalize">{a.type.toLowerCase().replace(/_/g, " ")}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Communications Tab ───────────────────────────────────────────────────────

function CommunicationsTab({
  activities,
  doNotEmail,
  doNotContact,
  emailOptOut,
  constituentId,
}: {
  activities: ConstituentDetail["activities"];
  doNotEmail: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
  constituentId: string;
}) {
  const commsActivity = activities.filter((a) =>
    ["EMAIL", "NOTE", "CALL", "TASK", "PROFILE_UPDATE"].includes(a.type)
  );

  return (
    <div className="space-y-4">
      {(doNotContact || doNotEmail || emailOptOut) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-4 w-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">Communication is restricted for this profile.</p>
            <p className="text-xs text-red-600 mt-0.5">Review donor preferences before sending any outreach.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/communications?new=1&source=constituent&constituentId=${constituentId}`} className={ACTION_BTN}>Draft Email</Link>
        <Link href={`/letters-printables/generate?constituentId=${constituentId}`} className={ACTION_BTN}>Create Letter</Link>
        <Link href={`/meetings?constituentId=${constituentId}`} className={ACTION_BTN}>Log Call</Link>
      </div>

      {commsActivity.length === 0 ? (
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>}
          title="No communication records"
          description="Emails, calls, and notes will be logged here as they happen."
        />
      ) : (
        <div className="space-y-2">
          {commsActivity.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <ActivityDot type={a.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 leading-snug">{a.description}</p>
                <p className="mt-0.5 text-xs text-gray-400">{formatDate(a.createdAt)} · <span className="capitalize">{a.type.toLowerCase().replace(/_/g, " ")}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── In-Development Tab ───────────────────────────────────────────────────────

function InDevTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-3">
        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700">{title} is in development</p>
      <p className="mt-1 text-xs text-gray-500 max-w-xs">{description}</p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-500 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "HIGH" ? "bg-red-100 text-red-700" :
    priority === "MEDIUM" ? "bg-amber-100 text-amber-700" :
    "bg-gray-100 text-gray-600";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {priority.toLowerCase()}
    </span>
  );
}

function ActivityDot({ type }: { type: string }) {
  const cls =
    type === "EMAIL" ? "bg-blue-500" :
    type === "CALL" ? "bg-emerald-500" :
    type === "DONATION" ? "bg-yellow-500" :
    type === "NOTE" ? "bg-purple-500" :
    type === "TASK" ? "bg-orange-500" :
    "bg-gray-400";
  return <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex gap-4">
          <div className="h-14 w-14 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="h-4 w-64 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-white rounded-xl border border-gray-200" />)}
      </div>
    </div>
  );
}

function ErrorState({ error, id }: { error: string | null; id: string }) {
  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-emerald-600">Constituents</Link>
        {" / "}
        <span className="text-gray-900">Not Found</span>
      </nav>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Constituent not found</h2>
        <p className="text-sm text-gray-400 mt-1">{error ?? `No record with ID: ${id}`}</p>
        <Link href="/constituents" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
          Back to Constituents
        </Link>
      </div>
    </div>
  );
}
