/** Login page — premium split-tone auth screen aligned with the setup experience. */
"use client";

import Image from "next/image";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { fetchWorkspaceSettings, resolveWorkspaceLandingPath } from "@/app/lib/workspace-settings";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** LoginPage renders the authentication form and redirects to /setup when first-run is incomplete. */
export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  /**
   * On mount: check whether setup has been completed.
   * Redirects to /setup when the bootstrap wizard hasn't run yet.
   */
  useEffect(() => {
    let cancelled = false;

    async function checkSetupStatus() {
      setCheckingSetup(true);
      try {
        const res = await fetch(`${API}/api/setup/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (!cancelled && !payload?.data?.setupCompleted) {
          router.replace("/setup");
          return;
        }
      } catch {
        // Keep login usable if the setup-status endpoint is temporarily unavailable.
      } finally {
        if (!cancelled) setCheckingSetup(false);
      }
    }

    void checkSetupStatus();
    return () => { cancelled = true; };
  }, [router]);

  /** Submits credentials and navigates to the workspace landing page on success. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      const workspaceSettings = await fetchWorkspaceSettings();
      router.replace(resolveWorkspaceLandingPath(workspaceSettings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  /* ── Loading state while setup check runs ──────────────────── */
  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Main login UI ──────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-green-50 via-white to-slate-50 px-4 py-6 lg:px-8 lg:py-10">
      {/* Setup-style atmospheric accents. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-green-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-sm lg:grid-cols-2">
        {/* Left: light onboarding-style context panel. */}
        <section className="relative flex flex-col justify-between border-b border-slate-200 bg-gradient-to-b from-white via-green-50/70 to-slate-50 p-8 lg:border-b-0 lg:border-r lg:p-12">
          <div aria-hidden="true" className="absolute -right-14 -top-10 h-44 w-44 rounded-full bg-green-200/35 blur-2xl" />

          <div className="relative z-10">
            <Image
              src="/branding/oyama-logo-w384.png"
              alt="OyamaCRM"
              width={220}
              height={66}
              priority
              className="h-auto w-[210px] sm:w-[230px]"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">Steward Access</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">Welcome back to OyamaCRM</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
              Your nonprofit operations dashboard is ready. Sign in to continue managing constituents, donations, campaigns, and stewardship workflows.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-green-200/70 bg-white/85 p-4 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">Guided and reliable</p>
                <p className="mt-1 text-slate-600">Same premium interaction style as your setup experience, now in daily sign-in.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">Secure by design</p>
                <p className="mt-1 text-slate-600">Session control, audit logs, and role-based access keep your organization protected.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-800">
            <span className="h-2 w-2 rounded-full bg-green-600" />
            Nonprofit Management Platform
          </div>
        </section>

        {/* Right: dark sign-in panel for split light/dark experience. */}
        <section className="relative flex items-center bg-slate-950 p-6 sm:p-8 lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.22) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(22,163,74,0.3) 0%, transparent 70%)" }}
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/85 p-7 shadow-xl backdrop-blur-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow-lg shadow-green-900/30">
                <Image src="/branding/oyama-mark-96.png" alt="OyamaCRM logo mark" width={26} height={26} className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-300">Secure Sign-In</p>
                <h2 className="text-xl font-semibold text-slate-100">Access your workspace</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-slate-300">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@organization.org"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="#fca5a5" strokeWidth="1.5" />
                    <path d="M8 5v3M8 10.5v.5" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-700 to-green-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-900/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-white/10 pt-5 text-xs text-slate-400">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#64748b" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Protected with AES-256 encryption
            </div>

            {process.env.NODE_ENV !== "production" && (
              <div className="mt-4 rounded-xl border border-amber-300/35 bg-amber-400/10 p-3 text-xs text-amber-200">
                <p className="font-semibold">Dev credentials</p>
                <p className="mt-1 text-amber-100/90">admin@hopefoundation.org / admin123!</p>
                <p className="text-amber-100/90">james@hopefoundation.org / staff123!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
