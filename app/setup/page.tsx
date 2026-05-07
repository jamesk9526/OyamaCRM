/** Setup page provides first-run onboarding and posts setup completion to the API. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SetupStepKey = "welcome" | "organization" | "branding" | "workspaces" | "admin" | "defaults" | "review";

interface SetupStatusResponse {
  success: boolean;
  data?: {
    setupCompleted: boolean;
  };
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
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

const SETUP_STEPS: Array<{ key: SetupStepKey; label: string }> = [
  { key: "welcome", label: "Welcome" },
  { key: "organization", label: "Organization" },
  { key: "branding", label: "Branding" },
  { key: "workspaces", label: "Workspaces" },
  { key: "admin", label: "Admin User" },
  { key: "defaults", label: "Defaults" },
  { key: "review", label: "Review" },
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
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
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

  /** Proceeds to the next setup step when available. */
  function nextStep() {
    setStepIndex((prev) => Math.min(prev + 1, SETUP_STEPS.length - 1));
  }

  /** Returns to the previous setup step when available. */
  function previousStep() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  /** Submits setup completion payload to the API and redirects to login on success. */
  async function completeSetup() {
    setSubmitting(true);
    setError(null);
    setSubmitted(false);
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
          },
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

      setSubmitted(true);
      setTimeout(() => {
        router.replace("/login");
      }, 900);
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
      {
        label: "Workspaces",
        value:
          `${form.enableOyamaCRM ? "OyamaCRM" : ""}${form.enableOyamaCRM && form.enableCompassion ? " + " : ""}${form.enableCompassion ? "OyamaCRM-Compassion" : ""}` ||
          "None selected",
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-700">First-Run Setup</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Welcome to OyamaCRM</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up organization details, branding, workspaces, and your first admin account.
          </p>
          <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-green-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SETUP_STEPS.map((s, i) => (
              <span
                key={s.key}
                className={`text-xs px-2 py-1 rounded-full border ${
                  i === stepIndex ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {i + 1}. {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {error}
            </div>
          )}

          {step.key === "welcome" && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Get Started</h2>
              <p className="text-sm text-gray-600">
                This setup will prepare organization profile, branding, workspace access, and your first Super Admin user.
              </p>
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

          {step.key === "branding" && (
            <section className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-600">
                Primary Color
                <input
                  value={form.primaryColor}
                  onChange={(e) => setField("primaryColor", e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="text-sm text-gray-600">
                Accent Color
                <input
                  value={form.accentColor}
                  onChange={(e) => setField("accentColor", e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
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
                Enable OyamaCRM (donor/fundraising workspace)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.enableCompassion}
                  onChange={(e) => setField("enableCompassion", e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Enable OyamaCRM-Compassion (client-services workspace)
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

          {step.key === "defaults" && (
            <section className="space-y-3 text-sm text-gray-600">
              <p>Default donor, compassion, and scheduling seed values will be applied at setup completion.</p>
              <ul className="space-y-2">
                {["Donor statuses", "Payment methods", "Client statuses", "Appointment statuses", "Default office hours"].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ),
                )}
              </ul>
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
              <p className="text-sm text-green-700 mt-1">Redirecting to login…</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
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
  );
}
