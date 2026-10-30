"use client";

import Link from "next/link";
import ProfileAvatar, { profileName } from "@/app/components/community/ProfileAvatar";
import { FormEvent, useEffect, useState, useRef } from "react";
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
  const submitting = useRef(false);
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
    if (!profile || submitting.current) return;
    submitting.current = true;
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
      submitting.current = false;
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
        <div className="border-b border-slate-200 bg-[linear-gradient(120deg,#10273d,#075b59)] px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">My OyamaCRM profile</p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "#fff" }}>Make your introduction</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">A professional profile helps your colleagues recognize you and understand your role. Keep your details current and review your account activity below.</p>
        </div>

        {loading ? <p className="p-6 text-sm text-slate-600">Loading your profile…</p> : null}
        {error ? <p role="alert" className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p role="status" className="mx-6 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}

        {profile ? (
          <form onSubmit={save} className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
            <fieldset disabled={saving} className="min-w-0 space-y-5">
              <legend className="mb-4 text-lg font-semibold">Professional details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" value={profile.firstName} onChange={(value) => update("firstName", value)} required />
                <Field label="Last name" value={profile.lastName} onChange={(value) => update("lastName", value)} required />
                <Field label="Preferred name" value={profile.preferredName ?? ""} onChange={(value) => update("preferredName", value)} />
                <Field label="Work phone" value={profile.phone ?? ""} onChange={(value) => update("phone", value)} type="tel" />
                <Field label="Job title" value={profile.jobTitle ?? ""} onChange={(value) => update("jobTitle", value)} />
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>Timezone</span>
                  <select value={profile.timezone ?? "America/Chicago"} onChange={(event) => update("timezone", event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}
                  </select>
                </label>
              </div>
              <Field label="Profile photo URL (HTTPS)" value={profile.avatarUrl ?? ""} onChange={(value) => update("avatarUrl", value)} type="url" />
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>About me</span>
                <textarea value={profile.bio ?? ""} onChange={(event) => update("bio", event.target.value)} maxLength={1000} rows={5} placeholder="Tell your team about your role, experience, and areas you can help with." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
                <p className="text-xs text-slate-600">Email and role are managed as account-security fields.</p>
                <button type="submit" disabled={saving} className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-60">
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </fieldset>

            <aside className="min-w-0 space-y-4">
              <section className="rounded-xl border border-teal-100 bg-teal-50 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-teal-800">Profile preview</p>
                <ProfileAvatar person={profile} large />
                <h2 className="mt-4 break-words text-xl font-semibold">{profileName(profile)}</h2>
                <p className="mt-1 text-sm font-medium text-teal-800">{profile.jobTitle || "Add your job title"}</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{profile.bio || "Introduce your role, experience, and how you help the team."}</p>
                <p className="mt-4 text-xs font-semibold text-teal-900">{[profile.jobTitle, profile.bio, profile.phone, profile.timezone].filter(value => value?.trim()).length} of 4 professional details completed</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">Complete your title, introduction, work phone, and timezone. Your photo is optional.</p>
                {profile.role === "admin" && <><p className="mt-4 text-xs leading-5 text-slate-700">Your saved name, photo, title, introduction, timezone, email and phone appear in your organization’s admin directory. Account activity stays private to this profile page.</p><Link href="/community" className="mt-4 inline-block text-sm font-semibold text-teal-800">Open Admin community →</Link></>}
              </section>
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
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</dt><dd className="mt-0.5 break-words text-slate-900">{value}</dd></div>;
}

function UsagePanel({ usage }: { usage: Usage }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Usage — last {usage.periodDays} days</h2>
        <span className="text-xs text-slate-600">{usage.lastActivityAt ? `Last active ${new Date(usage.lastActivityAt).toLocaleDateString()}` : "No activity"}</span>
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
            <p className="text-xs text-slate-600">{label}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Recent activity</h3>
      <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-auto">
        {usage.recentActivity.slice(0, 12).map((entry) => (
          <div key={entry.id} className="py-2.5">
            <p className="text-sm font-medium text-slate-800">{formatAction(entry.action)}</p>
            <p className="text-xs text-slate-600">{entry.entity ?? "Application"} · {new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {usage.recentActivity.length === 0 ? <p className="py-3 text-sm text-slate-600">No audit activity has been recorded yet.</p> : null}
      </div>
    </div>
  );
}
