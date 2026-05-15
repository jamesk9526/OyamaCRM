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

  /* ── Main login UI — split gateway (half white / half secure dark) ─────── */
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <div className="grid h-full grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden lg:flex flex-col justify-between bg-white p-12 xl:p-16">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-green-100/70 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-slate-100 blur-3xl" />

          <div className="relative z-10">
            <Image
              src="/branding/oyama-logo-w384.png"
              alt="OyamaCRM"
              width={280}
              height={84}
              priority
              className="h-auto w-[220px] xl:w-[260px] object-contain"
            />
            <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.03em] text-slate-900 xl:text-5xl">
              Welcome to your nonprofit growth gateway.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
              Stewardship, campaigns, client services, and events in one platform designed for real nonprofit teams.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              DonorCRM
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Compassion CRM
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Events CRM
            </span>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-[linear-gradient(165deg,#0a1321_0%,#0f172a_55%,#0d1e18_100%)] px-4 py-8 sm:px-8 lg:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.22) 1px, transparent 0)", backgroundSize: "30px 30px" }} />
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-[110px]" style={{ background: "radial-gradient(circle, rgba(22,163,74,0.24) 0%, transparent 72%)" }} />

          <div className="relative z-10 w-full max-w-[360px] rounded-2xl border border-white/10 bg-slate-900/72 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="mb-5">
              <div className="mb-3 lg:hidden">
                <Image
                  src="/branding/oyama-logo-w384.png"
                  alt="OyamaCRM"
                  width={200}
                  height={60}
                  priority
                  className="h-auto w-[170px] object-contain"
                />
              </div>
              <h2 className="text-base font-semibold text-slate-100">Sign in to your workspace</h2>
              <p className="mt-0.5 text-xs text-slate-500">Enter your credentials to continue</p>
            </div>

            {!mfaChallenge ? (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-400">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@organization.org"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/25 placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-400">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/25 placeholder:text-slate-600"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                    <svg className="mt-px shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="#fca5a5" strokeWidth="1.5" />
                      <path d="M8 5v3M8 10.5v.5" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-700 to-green-500 py-2 text-sm font-semibold text-white shadow-md shadow-green-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <a href="/login/forgot-password" className="text-[11px] text-green-400/80 hover:text-green-300 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-3.5">
                <p className="text-xs text-slate-400">
                  Enter the 6-digit code sent to <span className="font-semibold text-slate-200">{mfaChallenge.destinationHint}</span>.
                </p>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-400">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="123456"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/25"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-700 to-green-500 py-2 text-sm font-semibold text-white shadow-md shadow-green-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMfaChallenge(null); setMfaCode(""); setError(null); }}
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Back to login
                </button>
              </form>
            )}

            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-white/8 pt-4 text-[11px] text-slate-600">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#475569" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Protected with AES-256 encryption
            </div>

            {process.env.NODE_ENV !== "production" && (
              <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-400/8 p-3 text-[11px] text-amber-300/90">
                <p className="font-semibold text-amber-300">Dev credentials</p>
                <p className="mt-1">admin@hopefoundation.org / admin123!</p>
                <p>james@hopefoundation.org / staff123!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
