/** Login page — premium split-tone auth screen aligned with the setup experience. */
"use client";

import Image from "next/image";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { verifyEmailMfa, type LoginMfaChallenge } from "@/app/lib/auth-client";
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
  const [mfaChallenge, setMfaChallenge] = useState<LoginMfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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
      const loginResult = await signIn(email, password);
      if (loginResult.mfaRequired) {
        setMfaChallenge(loginResult);
        return;
      }

      const workspaceSettings = await fetchWorkspaceSettings();
      router.replace(resolveWorkspaceLandingPath(workspaceSettings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  /** Verifies one email MFA code and completes sign-in. */
  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaChallenge) return;
    setError(null);
    setLoading(true);
    try {
      await verifyEmailMfa(mfaChallenge.mfaTicket, mfaCode);
      const workspaceSettings = await fetchWorkspaceSettings();
      router.replace(resolveWorkspaceLandingPath(workspaceSettings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setLoading(false);
    }
  }

  /* ── Loading state while setup check runs ──────────────────── */
  if (checkingSetup) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Main login UI — split layout: clean brand left / form right ─────── */
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f8faf9]">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_520px]">

        {/* ── Left brand panel ── */}
        <section className="relative hidden lg:flex flex-col items-center justify-center bg-white border-r border-slate-100 p-12 xl:p-16">
          {/* subtle decorative gradients */}
          <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-green-50 blur-3xl opacity-80" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-slate-50 blur-3xl" />

          <div className="relative z-10 w-full max-w-md">
            <Image
              src="/branding/oyama-logo.png"
              alt="OyamaCRM"
              width={200}
              height={84}
              priority
              className="h-auto w-[160px] xl:w-[190px] object-contain object-left"
            />
            <h1 className="mt-10 text-[2.6rem] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 xl:text-5xl">
              Your nonprofit,<br />
              <span className="text-green-600">fully connected.</span>
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-slate-500">
              Stewardship, campaigns, client services, and events in one platform built for real nonprofit teams.
            </p>

            {/* module pills */}
            <div className="mt-12 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Included modules</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  DonorCRM
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Compassion CRM
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Events CRM
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right form panel ── */}
        <section className="relative flex flex-col items-center justify-center bg-[#f8faf9] px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">

            {/* Mobile-only logo */}
            <div className="mb-8 flex justify-center lg:hidden">
              <Image
                src="/branding/oyama-logo.png"
                alt="OyamaCRM"
                width={160}
                height={67}
                priority
                className="h-auto w-[140px] object-contain"
              />
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Sign in to your workspace</h2>
                <p className="mt-1 text-sm text-slate-500">Enter your credentials to continue</p>
              </div>

            {!mfaChallenge ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@organization.org"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    <svg className="mt-px shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5" />
                      <path d="M8 5v3M8 10.5v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M14 12H3" /></svg>
                      Sign in
                    </>
                  )}
                </button>

                <div className="text-right">
                  <a href="/login/forgot-password" className="text-xs text-green-600 hover:text-green-700 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <p className="text-sm text-slate-600">
                  Enter the 6-digit code sent to <span className="font-semibold text-slate-900">{mfaChallenge.destinationHint}</span>.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="123456"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaChallenge(null); setMfaCode(""); setError(null); }}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Back to login
                </button>
              </form>
            )}

              <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-5 text-[11px] text-slate-400">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Protected with AES-256 encryption
              </div>

              {process.env.NODE_ENV !== "production" && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  <p className="font-semibold">Dev credentials</p>
                  <p className="mt-1">admin@hopefoundation.org / admin123!</p>
                  <p>james@hopefoundation.org / staff123!</p>
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-400">
              © {new Date().getFullYear()} OyamaCRM · All rights reserved
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
