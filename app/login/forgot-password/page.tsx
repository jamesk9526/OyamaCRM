/** Forgot password page for requesting secure password reset emails. */
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/app/lib/auth-client";

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
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Forgot Password</h1>
          <p className="mt-1 text-sm text-gray-600">Enter your account email and we will send a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="you@organization.org"
            />
          </label>

          {message && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <Link href="/login" className="block text-center text-sm text-gray-600 hover:text-gray-800">
          Back to login
        </Link>
      </section>
    </main>
  );
}
