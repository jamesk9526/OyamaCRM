/** Login page — premium split-tone auth screen aligned with the setup experience. */
"use client";

import Link from "next/link";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import LoginBrandPanel, { LoginMobileBrand } from "@/app/components/auth/LoginBrandPanel";
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

  /* ── Main login UI - split layout: curved brand left / form right ─────── */
  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-[#f4f7f6]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(430px,520px)]">

        {/* ── Left brand panel ── */}
        <LoginBrandPanel />

        {/* ── Right form panel ── */}
        <section className="relative flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#ffffff,#f3f7f6)] px-4 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[400px]">

            {/* Mobile-only logo */}
            <LoginMobileBrand />

            {/* Form card */}
            <div className="rounded-[22px] border border-slate-200/90 bg-white px-6 py-7 shadow-[0_20px_52px_rgba(15,23,42,0.10)] backdrop-blur sm:px-8 sm:py-8">
              <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Secure workspace</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Sign in to OyamaCRM</h2>
                <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to continue to your organization.</p>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
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
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">Need help signing in?</span>
                  <Link href="/login/forgot-password" className="text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-800">
                    Forgot password?
                  </Link>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaChallenge(null); setMfaCode(""); setError(null); }}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
