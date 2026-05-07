"use client";

import { useEffect, useState } from "react";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    user?: { firstName: string; lastName: string };
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/constituents/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
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

  if (loading) return <LoadingState />;
  if (error || !constituent) return <ErrorState error={error} id={id} />;

  const c = constituent;
  const fullName = `${c.prefix ? c.prefix + " " : ""}${c.firstName} ${c.lastName}`;
  const isHousehold = c.type === "HOUSEHOLD";

  const tabs = [
    ...(isHousehold ? [{ key: "household" as const, label: `Members (${c.headOf?.members?.length ?? 0})` }] : []),
    { key: "giving" as const, label: `Giving History (${c.donations?.length ?? 0})` },
    { key: "tasks" as const, label: `Tasks (${c.tasks?.length ?? 0})` },
    { key: "timeline" as const, label: `Timeline (${c.activities?.length ?? 0})` },
    { key: "notes" as const, label: "Notes" },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600 transition-colors">Constituents</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{fullName}</span>
      </nav>

      {/* Profile header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xl font-bold shrink-0">
              {isHousehold ? "🏠" : `${c.firstName[0]}${c.lastName[0]}`}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900">{fullName}</h1>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.donorStatus)}`}>
                  {statusLabel(c.donorStatus)}
                </span>
                <span className="text-xs text-gray-400">{typeLabel(c.type)}</span>
              </div>
              {c.employer && <p className="text-sm text-gray-500 mt-0.5">{c.employer}{c.occupation ? ` · ${c.occupation}` : ""}</p>}
              {/* Household membership badge */}
              {c.household && !isHousehold && (
                <p className="text-xs text-gray-400 mt-1">
                  Member of{" "}
                  <Link href={`/constituents/${c.household.head?.id}`} className="text-green-600 hover:underline">
                    {c.household.name}
                  </Link>
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {c.tags.map((t) => (
                  <span key={t.tagId} className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: t.tag.color }}>
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Link
            href={`/constituents/${id}/edit`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
        </div>

        {/* Contact grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm border-t border-gray-100 pt-4">
          {c.email && <ContactRow label="Email" value={c.email} href={`mailto:${c.email}`} />}
          {c.phone && <ContactRow label="Phone" value={c.phone} href={`tel:${c.phone}`} />}
          {c.mobile && <ContactRow label="Mobile" value={c.mobile} href={`tel:${c.mobile}`} />}
          {(c.city || c.state) && (
            <ContactRow label="Location" value={[c.city, c.state, c.zip].filter(Boolean).join(", ")} />
          )}
        </div>

        {/* Communication flags */}
        {(c.doNotEmail || c.doNotCall || c.doNotMail) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {c.doNotEmail && <Flag label="Do Not Email" />}
            {c.doNotCall && <Flag label="Do Not Call" />}
            {c.doNotMail && <Flag label="Do Not Mail" />}
          </div>
        )}
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

      {/* Tabbed detail */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "text-green-700 border-b-2 border-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "household" && c.headOf && (
            <HouseholdPanel householdId={c.headOf.id} headConstituentId={c.id} />
          )}
          {tab === "giving" && <GivingTab donations={c.donations ?? []} />}
          {tab === "tasks" && <TasksTab tasks={c.tasks ?? []} />}
          {tab === "timeline" && <TimelineTab activities={c.activities ?? []} />}
          {tab === "notes" && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {c.notes || <span className="text-gray-400 italic">No notes recorded.</span>}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">Record added {formatDate(c.createdAt)}</p>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GivingTab({ donations }: { donations: ConstituentDetail["donations"] }) {
  if (!donations.length) return <p className="text-sm text-gray-400 italic">No donations recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["Date", "Amount", "Campaign", "Fund", "Method", "Status"].map((h) => (
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

function ContactRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      {href ? (
        <a href={href} className="text-green-600 hover:underline">{value}</a>
      ) : (
        <p className="text-gray-700">{value}</p>
      )}
    </div>
  );
}

function Flag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
      ⛔ {label}
    </span>
  );
}

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
