/** Setup page provides a guided first-run onboarding experience for OyamaCRM. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SUCCESS_REDIRECT_DELAY_MS = 900;
const WORKSPACE_SETTINGS_KEY = "settings-workspaces";
const DASHBOARD_GOAL_MODE_KEY = "dashboard-revenue-goal-mode";
const DASHBOARD_MANUAL_GOAL_KEY = "dashboard-manual-revenue-goal";

type SetupStepKey = "welcome" | "organization" | "goals" | "settings" | "workspaces" | "admin" | "team" | "review";

interface SetupStatusResponse {
  success: boolean;
  data?: {
    setupCompleted: boolean;
  };
}

interface TeamUserDraft {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "manager" | "staff" | "readonly" | "report_viewer";
  password: string;
}

interface SetupFormState {
  organizationName: string;
  organizationType: string;
  primaryContactEmail: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  enableOyamaCRM: boolean;
  enableCompassion: boolean;
  defaultWorkspace: "donor" | "compassion";
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  goalsLater: boolean;
  annualRevenueGoal: string;
  donorRetentionGoal: string;
  averageGiftGoal: string;
  fiscalYearStart: number;
  currency: string;
  configureSmtpLater: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpFromName: string;
  smtpFromEmail: string;
  inviteTeamLater: boolean;
  teamUsers: TeamUserDraft[];
}

const SETUP_STEPS: Array<{ key: SetupStepKey; label: string; stewardLine: string }> = [
  { key: "welcome", label: "Welcome", stewardLine: "Welcome. Let us get your nonprofit ready in one guided flow." },
  { key: "organization", label: "Organization", stewardLine: "Tell me about your organization so records and receipts are accurate." },
  { key: "goals", label: "Goals", stewardLine: "Set first targets for revenue, retention, and average gift. You can change them later." },
  { key: "settings", label: "Core Settings", stewardLine: "Now configure defaults that power reports and communications." },
  { key: "workspaces", label: "Workspaces", stewardLine: "Choose which modules your team should use right away." },
  { key: "admin", label: "Admin", stewardLine: "Create your first Super Admin account." },
  { key: "team", label: "Team", stewardLine: "Add teammates now, or skip and invite them later in Settings." },
  { key: "review", label: "Review", stewardLine: "Great. Review and finish setup when ready." },
];

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD"];
const ROLE_OPTIONS: Array<{ value: TeamUserDraft["role"]; label: string }> = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "readonly", label: "Read Only" },
  { value: "report_viewer", label: "Report Viewer" },
];

/** SetupPage renders the onboarding wizard and handles setup status + completion calls. */
export default function SetupPage() {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<SetupFormState>({
    organizationName: "",
    organizationType: "Nonprofit",
    primaryContactEmail: "",
    timezone: "America/Chicago",
    primaryColor: "#16a34a",
    accentColor: "#0f766e",
    enableOyamaCRM: true,
    enableCompassion: true,
    defaultWorkspace: "donor",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
    goalsLater: false,
    annualRevenueGoal: "250000",
    donorRetentionGoal: "68",
    averageGiftGoal: "125",
    fiscalYearStart: 1,
    currency: "USD",
    configureSmtpLater: true,
    smtpHost: "",
    smtpPort: 587,
    smtpFromName: "",
    smtpFromEmail: "",
    inviteTeamLater: true,
    teamUsers: [],
  });

  const step = SETUP_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / SETUP_STEPS.length) * 100;

  /**
   * On mount, checks setup status and redirects to login if setup is already complete.
   * Watches no external state and only runs once.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSetupStatus() {
      setStatusLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API}/api/setup/status`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as SetupStatusResponse;
        if (!cancelled && payload?.data?.setupCompleted) {
          router.replace("/login");
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load setup status.");
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    }

    void loadSetupStatus();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Updates setup form fields in a typed way. */
  function setField<K extends keyof SetupFormState>(key: K, value: SetupFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  /** Appends a blank team-user draft row for optional onboarding invites. */
  function addTeamUser() {
    setForm((prev) => ({
      ...prev,
      teamUsers: [
        ...prev.teamUsers,
        {
          id: crypto.randomUUID(),
          firstName: "",
          lastName: "",
          email: "",
          role: "staff",
          password: "",
        },
      ],
    }));
  }

  /** Updates one field on a team-user draft row. */
  function updateTeamUser(id: string, updates: Partial<TeamUserDraft>) {
    setForm((prev) => ({
      ...prev,
      teamUsers: prev.teamUsers.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
  }

  /** Removes a team-user draft row. */
  function removeTeamUser(id: string) {
    setForm((prev) => ({ ...prev, teamUsers: prev.teamUsers.filter((u) => u.id !== id) }));
  }

  /** Determines whether the current step can continue. */
  const canContinue = useMemo(() => {
    if (step.key === "organization") {
      return form.organizationName.trim().length > 1;
    }
    if (step.key === "workspaces") {
      return form.enableOyamaCRM || form.enableCompassion;
    }
    if (step.key === "admin") {
      return (
        form.adminFirstName.trim().length > 0
        && form.adminLastName.trim().length > 0
        && form.adminEmail.trim().length > 3
        && form.adminPassword.length >= 8
      );
    }
    if (step.key === "team" && !form.inviteTeamLater) {
      return form.teamUsers.every(
        (u) => u.firstName.trim() && u.lastName.trim() && u.email.trim() && u.password.length >= 8,
      );
    }
    return true;
  }, [step.key, form]);

  /** Proceeds to the next setup step when available and valid. */
  function nextStep() {
    if (!canContinue) {
      setError("Please complete required fields before continuing.");
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, SETUP_STEPS.length - 1));
  }

  /** Returns to the previous setup step when available. */
  function previousStep() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  /** Builds payload and submits setup completion request. */
  async function completeSetup() {
    setSubmitting(true);
    setError(null);
    setSubmitted(false);

    const goals = form.goalsLater
      ? undefined
      : {
          annualRevenueGoal: Number(form.annualRevenueGoal || 0) || null,
          donorRetentionGoal: Number(form.donorRetentionGoal || 0) || null,
          averageGiftGoal: Number(form.averageGiftGoal || 0) || null,
        };

    const teamUsers = form.inviteTeamLater
      ? []
      : form.teamUsers
          .filter((u) => u.firstName.trim() && u.lastName.trim() && u.email.trim() && u.password.length >= 8)
          .map((u) => ({
            firstName: u.firstName.trim(),
            lastName: u.lastName.trim(),
            email: u.email.trim(),
            role: u.role,
            password: u.password,
          }));

    try {
      const response = await fetch(`${API}/api/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: {
            name: form.organizationName,
            organizationType: form.organizationType,
            primaryContactEmail: form.primaryContactEmail,
            timezone: form.timezone,
          },
          branding: {
            primaryColor: form.primaryColor,
            accentColor: form.accentColor,
          },
          workspaces: {
            oyamacrm: form.enableOyamaCRM,
            oyamacrmCompassion: form.enableCompassion,
            defaultWorkspace: form.defaultWorkspace,
          },
          defaults: {
            fiscalYearStart: form.fiscalYearStart,
            currency: form.currency,
            timezone: form.timezone,
            smtpHost: form.configureSmtpLater ? undefined : form.smtpHost,
            smtpPort: form.configureSmtpLater ? undefined : form.smtpPort,
            smtpFromName: form.configureSmtpLater ? undefined : form.smtpFromName,
            smtpFromEmail: form.configureSmtpLater ? undefined : form.smtpFromEmail,
          },
          goals,
          teamUsers,
          adminUser: {
            firstName: form.adminFirstName,
            lastName: form.adminLastName,
            email: form.adminEmail,
            password: form.adminPassword,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }

      // Keep setup-driven workspace defaults available in Settings until backend preference routes are finalized.
      localStorage.setItem(
        WORKSPACE_SETTINGS_KEY,
        JSON.stringify({
          donorEnabled: form.enableOyamaCRM,
          compassionEnabled: form.enableCompassion,
          defaultWorkspace: form.defaultWorkspace,
        }),
      );

      // Seed dashboard manual goal from onboarding goals when provided.
      if (!form.goalsLater && Number(form.annualRevenueGoal || 0) > 0) {
        localStorage.setItem(DASHBOARD_GOAL_MODE_KEY, "MANUAL");
        localStorage.setItem(DASHBOARD_MANUAL_GOAL_KEY, String(Number(form.annualRevenueGoal)));
      }

      setSubmitted(true);
      setTimeout(() => {
        router.replace("/login");
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  const reviewRows = useMemo(
    () => [
      { label: "Organization", value: form.organizationName || "Not set" },
      { label: "Type", value: form.organizationType },
      { label: "Primary Contact Email", value: form.primaryContactEmail || "Not set" },
      { label: "Timezone", value: form.timezone },
      { label: "Currency", value: form.currency },
      { label: "Fiscal Year Starts", value: String(form.fiscalYearStart) },
      {
        label: "Workspaces",
        value:
          `${form.enableOyamaCRM ? "DonorCRM" : ""}${form.enableOyamaCRM && form.enableCompassion ? " + " : ""}${form.enableCompassion ? "Compassion CRM" : ""}` ||
          "None selected",
      },
      {
        label: "Onboarding Goals",
        value: form.goalsLater ? "Set later in Settings" : `$${Number(form.annualRevenueGoal || 0).toLocaleString()} revenue target`,
      },
      {
        label: "Team Invites",
        value: form.inviteTeamLater ? "Invite later" : `${form.teamUsers.length} queued user(s)`,
      },
      { label: "Admin", value: `${form.adminFirstName} ${form.adminLastName}`.trim() || "Not set" },
      { label: "Admin Email", value: form.adminEmail || "Not set" },
    ],
    [form],
  );

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="grid lg:grid-cols-[320px_1fr]">
          <aside className="relative bg-gradient-to-b from-green-600 to-emerald-600 text-white p-6">
            <div className="absolute -right-10 -top-8 w-32 h-32 rounded-full bg-white/15 blur-md animate-pulse" />
            <div className="absolute -left-6 bottom-8 w-20 h-20 rounded-full bg-emerald-300/25 blur-sm animate-bounce" />

            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-green-100">Steward Guided Setup</p>
            <h1 className="text-2xl font-semibold mt-2 leading-tight">Let Steward walk you through first-time configuration.</h1>
            <p className="text-sm text-green-100 mt-3 min-h-[64px]">{step.stewardLine}</p>

            <div className="mt-5 h-2 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-5 space-y-2">
              {SETUP_STEPS.map((s, i) => (
                <div key={s.key} className={`rounded-lg px-3 py-2 text-xs border ${i === stepIndex ? "bg-white/15 border-white/40" : "bg-white/5 border-white/10"}`}>
                  <span className="font-semibold">{i + 1}.</span> {s.label}
                </div>
              ))}
            </div>
          </aside>

          <div className="p-6 md:p-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {error}
              </div>
            )}

            {step.key === "welcome" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Welcome to OyamaCRM</h2>
                <p className="text-sm text-gray-600">
                  This guided flow will set your organization profile, fundraising goals, core settings, workspace configuration,
                  and your first users.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "Fundraising goals and dashboard defaults",
                    "Timezone, fiscal year, currency, and email defaults",
                    "Workspace setup for DonorCRM and Compassion CRM",
                    "Admin account plus optional team onboarding",
                  ].map((item) => (
                    <div key={item} className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {step.key === "organization" && (
              <section className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm text-gray-600">
                  Organization Name
                  <input
                    value={form.organizationName}
                    onChange={(e) => setField("organizationName", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Hope Community Foundation"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Organization Type
                  <select
                    value={form.organizationType}
                    onChange={(e) => setField("organizationType", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option>Pregnancy Care Center</option>
                    <option>Nonprofit</option>
                    <option>Church / Ministry</option>
                    <option>Community Resource Center</option>
                    <option>Medical / Care Organization</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="text-sm text-gray-600">
                  Primary Contact Email
                  <input
                    type="email"
                    value={form.primaryContactEmail}
                    onChange={(e) => setField("primaryContactEmail", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="director@example.org"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Timezone
                  <input
                    value={form.timezone}
                    onChange={(e) => setField("timezone", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
              </section>
            )}

            {step.key === "goals" && (
              <section className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.goalsLater}
                    onChange={(e) => setField("goalsLater", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Set fundraising goals later in Settings
                </label>
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="text-sm text-gray-600">
                    Annual Revenue Goal
                    <input
                      type="number"
                      min={0}
                      value={form.annualRevenueGoal}
                      disabled={form.goalsLater}
                      onChange={(e) => setField("annualRevenueGoal", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    Donor Retention Goal (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.donorRetentionGoal}
                      disabled={form.goalsLater}
                      onChange={(e) => setField("donorRetentionGoal", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    Average Gift Goal
                    <input
                      type="number"
                      min={0}
                      value={form.averageGiftGoal}
                      disabled={form.goalsLater}
                      onChange={(e) => setField("averageGiftGoal", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                </div>
              </section>
            )}

            {step.key === "settings" && (
              <section className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="text-sm text-gray-600">
                    Fiscal Year Start (month)
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={form.fiscalYearStart}
                      onChange={(e) => setField("fiscalYearStart", Number(e.target.value || 1))}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    Currency
                    <select
                      value={form.currency}
                      onChange={(e) => setField("currency", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-gray-600">
                    Timezone
                    <input
                      value={form.timezone}
                      onChange={(e) => setField("timezone", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.configureSmtpLater}
                    onChange={(e) => setField("configureSmtpLater", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Configure SMTP/email sending later
                </label>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm text-gray-600">
                    SMTP Host
                    <input
                      value={form.smtpHost}
                      disabled={form.configureSmtpLater}
                      onChange={(e) => setField("smtpHost", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="smtp.example.org"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    SMTP Port
                    <input
                      type="number"
                      value={form.smtpPort}
                      disabled={form.configureSmtpLater}
                      onChange={(e) => setField("smtpPort", Number(e.target.value || 587))}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    From Name
                    <input
                      value={form.smtpFromName}
                      disabled={form.configureSmtpLater}
                      onChange={(e) => setField("smtpFromName", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Hope Community Foundation"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    From Email
                    <input
                      type="email"
                      value={form.smtpFromEmail}
                      disabled={form.configureSmtpLater}
                      onChange={(e) => setField("smtpFromEmail", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="giving@example.org"
                    />
                  </label>
                </div>
              </section>
            )}

            {step.key === "workspaces" && (
              <section className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.enableOyamaCRM}
                    onChange={(e) => setField("enableOyamaCRM", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Enable DonorCRM workspace (donors, donations, campaigns, communications)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.enableCompassion}
                    onChange={(e) => setField("enableCompassion", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Enable Compassion CRM workspace (clients, cases, appointments)
                </label>
                <label className="text-sm text-gray-600 block pt-2">
                  Default workspace after login
                  <select
                    value={form.defaultWorkspace}
                    onChange={(e) => setField("defaultWorkspace", e.target.value as "donor" | "compassion")}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="donor">DonorCRM</option>
                    <option value="compassion">Compassion CRM</option>
                  </select>
                </label>
              </section>
            )}

            {step.key === "admin" && (
              <section className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm text-gray-600">
                  First Name
                  <input
                    value={form.adminFirstName}
                    onChange={(e) => setField("adminFirstName", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Last Name
                  <input
                    value={form.adminLastName}
                    onChange={(e) => setField("adminLastName", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="text-sm text-gray-600 sm:col-span-2">
                  Admin Email
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setField("adminEmail", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="text-sm text-gray-600 sm:col-span-2">
                  Admin Password
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={(e) => setField("adminPassword", e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="At least 8 characters"
                  />
                </label>
              </section>
            )}

            {step.key === "team" && (
              <section className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.inviteTeamLater}
                    onChange={(e) => setField("inviteTeamLater", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Invite team members later in Settings > Users
                </label>

                {!form.inviteTeamLater && (
                  <div className="space-y-3">
                    {form.teamUsers.map((user) => (
                      <div key={user.id} className="rounded-xl border border-gray-200 p-3 grid md:grid-cols-6 gap-2">
                        <input
                          value={user.firstName}
                          onChange={(e) => updateTeamUser(user.id, { firstName: e.target.value })}
                          className="md:col-span-1 px-2 py-2 text-sm border border-gray-300 rounded-lg"
                          placeholder="First"
                        />
                        <input
                          value={user.lastName}
                          onChange={(e) => updateTeamUser(user.id, { lastName: e.target.value })}
                          className="md:col-span-1 px-2 py-2 text-sm border border-gray-300 rounded-lg"
                          placeholder="Last"
                        />
                        <input
                          type="email"
                          value={user.email}
                          onChange={(e) => updateTeamUser(user.id, { email: e.target.value })}
                          className="md:col-span-2 px-2 py-2 text-sm border border-gray-300 rounded-lg"
                          placeholder="teammate@example.org"
                        />
                        <select
                          value={user.role}
                          onChange={(e) => updateTeamUser(user.id, { role: e.target.value as TeamUserDraft["role"] })}
                          className="md:col-span-1 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                        >
                          {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>
                        <div className="md:col-span-1 flex gap-2">
                          <input
                            type="password"
                            value={user.password}
                            onChange={(e) => updateTeamUser(user.id, { password: e.target.value })}
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                            placeholder="Temp password"
                          />
                          <button
                            type="button"
                            onClick={() => removeTeamUser(user.id)}
                            className="px-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addTeamUser}
                      className="px-3 py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50"
                    >
                      + Add Team User
                    </button>
                  </div>
                )}
              </section>
            )}

            {step.key === "review" && (
              <section className="space-y-2">
                {reviewRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 border-b border-gray-100 py-2">
                    <span className="text-sm text-gray-500">{row.label}</span>
                    <span className="text-sm font-medium text-gray-900 text-right">{row.value}</span>
                  </div>
                ))}
              </section>
            )}

            {submitted && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700 font-medium">Setup completed successfully.</p>
                <p className="text-sm text-green-700 mt-1">Redirecting to login...</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={previousStep}
                disabled={stepIndex === 0 || submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              {step.key === "review" ? (
                <button
                  onClick={completeSetup}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  {submitting ? "Completing..." : "Complete Setup"}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
