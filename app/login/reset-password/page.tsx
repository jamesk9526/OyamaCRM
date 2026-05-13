/** Reset password page for consuming one-time password reset tokens. */
"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPasswordWithToken } from "@/app/lib/auth-client";

/** Renders one token-based password reset form with confirmation and policy guidance. */
function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Submits one token + password reset request and routes back to login on success. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Reset token is missing. Use the full link from your email.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithToken(token, password);
      setSuccess("Password updated. Redirecting to login...");
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reset Password</h1>
          <p className="mt-1 text-sm text-gray-600">Create a new password for your account.</p>
          <p className="mt-2 text-xs text-gray-500">Use at least 10 characters and include 3 of: lowercase, uppercase, number, symbol.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">New password</span>
            <input
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Confirm password</span>
            <input
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          {success && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <Link href="/login" className="block text-center text-sm text-gray-600 hover:text-gray-800">
          Back to login
        </Link>
      </section>
    </main>
  );
}

/** Wraps reset-password client search-params usage in Suspense for build-time prerender compatibility. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-slate-50" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
