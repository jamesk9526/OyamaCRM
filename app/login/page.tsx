/** Login page — sleek dark-themed auth screen with GitHub-dark palette. */
"use client";

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
      <div style={{ background: "#0d1117" }} className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Main login UI ──────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#0d1117", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Dot-grid background texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #30363d 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.4,
          zIndex: 0,
        }}
      />
      {/* Green radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed"
        style={{
          top: "-160px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "500px",
          background: "radial-gradient(ellipse at center, rgba(35,134,54,0.14) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div className="relative w-full max-w-sm z-10">

        {/* ── Brand mark ─────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-8 select-none">
          {/* Logo mark */}
          <div
            className="flex items-center justify-center mb-4 rounded-2xl"
            style={{ width: 56, height: 56, background: "#238636", boxShadow: "0 0 0 1px rgba(240,246,252,0.1), 0 8px 24px rgba(35,134,54,0.35)" }}
          >
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path d="M8 20L14 8L20 20M10.5 15.5H17.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#e6edf3", letterSpacing: "-0.02em" }}>
            OyamaCRM
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>Nonprofit Management Platform</p>

          {/* Trust pill */}
          <div
            className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.25)", color: "#3fb950" }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2s6 2.5 6 6.5V12l-6 2-6-2V8.5C2 4.5 8 2 8 2z" stroke="#3fb950" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Secure · Open Source · Self-Hosted
          </div>
        </div>

        {/* ── Auth card ──────────────────────────────────────── */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >
          <div className="mb-6">
            <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Welcome back</h2>
            <p className="text-sm mt-1" style={{ color: "#8b949e" }}>Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#8b949e", letterSpacing: "0.02em" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@organization.org"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg transition-all outline-none"
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  color: "#e6edf3",
                  caretColor: "#3fb950",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#238636"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35,134,54,0.15)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#8b949e", letterSpacing: "0.02em" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg transition-all outline-none"
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  color: "#e6edf3",
                  caretColor: "#3fb950",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#238636"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35,134,54,0.15)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)", color: "#f85149" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="#f85149" strokeWidth="1.5"/>
                  <path d="M8 5v3M8 10.5v.5" stroke="#f85149" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-all mt-2 flex items-center justify-center gap-2"
              style={{
                background: loading ? "#1a7f37" : "#238636",
                color: "#fff",
                border: "1px solid rgba(240,246,252,0.1)",
                boxShadow: "0 1px 0 rgba(27,31,36,0.1)",
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#2ea043"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#238636"; }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer trust line */}
          <div className="flex items-center justify-center gap-1.5 mt-6 pt-5" style={{ borderTop: "1px solid #21262d" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#484f58" strokeWidth="1.5"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="#484f58" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-xs" style={{ color: "#484f58" }}>Protected with AES-256 encryption</span>
          </div>
        </div>

        {/* ── Dev credentials hint ────────────────────────────── */}
        {process.env.NODE_ENV !== "production" && (
          <div
            className="mt-4 rounded-xl p-4 text-xs"
            style={{ background: "rgba(210,153,34,0.08)", border: "1px solid rgba(210,153,34,0.25)", color: "#d29922" }}
          >
            <p className="font-semibold mb-1">Dev credentials</p>
            <p style={{ color: "#8b949e" }}>admin@hopefoundation.org / admin123!</p>
            <p style={{ color: "#8b949e" }}>james@hopefoundation.org / staff123!</p>
          </div>
        )}
      </div>
    </div>
  );
}
