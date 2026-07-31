/** Forgot password page for requesting secure password reset emails. */
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/app/lib/auth-client";
import LoginBrandPanel, { LoginMobileBrand } from "@/app/components/auth/LoginBrandPanel";

/** Renders one public form to request a password reset link via email. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Submits one reset-email request while preserving account privacy in responses. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage("If that email exists, a password reset link has been sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen overflow-x-hidden bg-[#f5f5f5]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(430px,520px)]">
        <LoginBrandPanel />
        <section className="relative flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(15,108,189,0.08),transparent_34%),linear-gradient(180deg,#ffffff,#f5f5f5)] px-4 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[400px]">
            <LoginMobileBrand />
            <div className="border border-[#d1d1d1] bg-white px-6 py-7 shadow-[0_8px_24px_rgba(15,23,42,0.10)] sm:px-8 sm:py-8">
              <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f548c]">Account recovery</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Reset your password</h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">Enter your work email. If it matches an active account, we’ll send a secure reset link.</p>
              </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading || Boolean(message)}
              className="w-full border border-[#8a8886] bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f6cbd] focus:ring-2 focus:ring-[#c7e0f4] placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="you@organization.org"
            />
          </label>

          {message && <p role="status" className="border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-800">{message} Check your inbox and spam folder.</p>}
          {error && <p role="alert" className="border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center bg-[#0f6cbd] py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(15,108,189,0.22)] transition hover:bg-[#0f548c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-[#0f548c] hover:text-[#0f6cbd]">
          Back to login
        </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
