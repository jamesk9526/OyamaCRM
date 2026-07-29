"use client";

import { FormEvent, useEffect, useState } from "react";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";

interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  phone: string | null;
  jobTitle: string | null;
  timezone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Usage {
  periodDays: number;
  actionCount: number;
  loginCount: number;
  activeDays: number;
  activeSessions: number;
  lastActivityAt: string | null;
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    createdAt: string;
  }>;
}

const TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

function formatAction(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PersonalProfileSettingsPage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ profile: Profile; usage: Usage }>("/api/users/me/profile")
      .then((data) => {
        setProfile(data.profile);
        setUsage(data.usage);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load profile."))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof Profile, value: string) {
    setProfile((current) => current ? { ...current, [field]: value } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await apiFetch<{ profile: Profile }>("/api/users/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          preferredName: profile.preferredName,
          phone: profile.phone,
          jobTitle: profile.jobTitle,
          timezone: profile.timezone,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
        }),
      });
      setProfile(result.profile);
      await refreshUser();
      setMessage("Profile saved. Your name is updated across OyamaCRM.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceBreadcrumbBar
        items={[{ label: "Donor CRM", href: "/" }, { label: "Settings", href: "/settings" }, { label: "My profile" }]}
        metadata="Personal settings and usage"
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[linear-gradient(120deg,#ecfdf5,#f8fafc_50%,#eff6ff)] px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">My OyamaCRM profile</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Personal information and account activity</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Keep your staff contact details current and review the real audit activity recorded for your account.</p>
        </div>

        {loading ? <p className="p-6 text-sm text-slate-500">Loading your profile…</p> : null}
        {error ? <p className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mx-6 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}

        {profile ? (
          <form onSubmit={save} className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" value={profile.firstName} onChange={(value) => update("firstName", value)} required />
                <Field label="Last name" value={profile.lastName} onChange={(value) => update("lastName", value)} required />
                <Field label="Preferred name" value={profile.preferredName ?? ""} onChange={(value) => update("preferredName", value)} />
                <Field label="Phone" value={profile.phone ?? ""} onChange={(value) => update("phone", value)} type="tel" />
                <Field label="Job title" value={profile.jobTitle ?? ""} onChange={(value) => update("jobTitle", value)} />
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>Timezone</span>
                  <select value={profile.timezone ?? "America/Chicago"} onChange={(event) => update("timezone", event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}
                  </select>
                </label>
              </div>
              <Field label="Profile image URL" value={profile.avatarUrl ?? ""} onChange={(value) => update("avatarUrl", value)} type="url" />
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>About me</span>
                <textarea value={profile.bio ?? ""} onChange={(event) => update("bio", event.target.value)} maxLength={1000} rows={5} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
                <p className="text-xs text-slate-500">Email and role are managed as account-security fields.</p>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Account</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <AccountLine label="Email" value={profile.email} />
                  <AccountLine label="Role" value={formatAction(profile.role)} />
                  <AccountLine label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />
                  <AccountLine label="Last sign-in" value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "Not recorded"} />
                </dl>
              </div>
              {usage ? <UsagePanel usage={usage} /> : null}
            </aside>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function AccountLine({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-slate-900">{value}</dd></div>;
}

function UsagePanel({ usage }: { usage: Usage }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Usage — last {usage.periodDays} days</h2>
        <span className="text-xs text-slate-500">{usage.lastActivityAt ? `Last active ${new Date(usage.lastActivityAt).toLocaleDateString()}` : "No activity"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Recorded actions", usage.actionCount],
          ["Sign-ins", usage.loginCount],
          ["Active days", usage.activeDays],
          ["Active sessions", usage.activeSessions],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xl font-semibold text-slate-950">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Recent activity</h3>
      <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-auto">
        {usage.recentActivity.slice(0, 12).map((entry) => (
          <div key={entry.id} className="py-2.5">
            <p className="text-sm font-medium text-slate-800">{formatAction(entry.action)}</p>
            <p className="text-xs text-slate-500">{entry.entity ?? "Application"} · {new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {usage.recentActivity.length === 0 ? <p className="py-3 text-sm text-slate-500">No audit activity has been recorded yet.</p> : null}
      </div>
    </div>
  );
}
