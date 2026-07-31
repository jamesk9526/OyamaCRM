/** Reset password page for consuming one-time password reset tokens. */
"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPasswordWithToken } from "@/app/lib/auth-client";
import LoginBrandPanel, { LoginMobileBrand } from "@/app/components/auth/LoginBrandPanel";
import PasswordInput from "@/app/components/auth/PasswordInput";

function passwordRequirements(password: string) {
  return [
    { label: "At least 10 characters", met: password.length >= 10 },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

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
  const requirements = passwordRequirements(password);
  const categoryCount = requirements.slice(1).filter((requirement) => requirement.met).length;
  const passwordMeetsPolicy = requirements[0].met && categoryCount >= 3;

  /** Submits one token + password reset request and routes back to login on success. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Reset token is missing. Use the full link from your email.");
      return;
    }

    if (!passwordMeetsPolicy) {
      setError("Choose a password that meets all of the requirements below.");
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
    <main className="min-h-screen w-screen overflow-x-hidden bg-[#f5f5f5]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(430px,520px)]">
        <LoginBrandPanel />
        <section className="relative flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(15,108,189,0.08),transparent_34%),linear-gradient(180deg,#ffffff,#f5f5f5)] px-4 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[400px]">
            <LoginMobileBrand />
            <div className="border border-[#d1d1d1] bg-white px-6 py-7 shadow-[0_8px_24px_rgba(15,23,42,0.10)] sm:px-8 sm:py-8">
              <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f548c]">Account recovery</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Choose a new password</h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">Use a password you have not used elsewhere.</p>
              </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">New password</label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
              minLength={10}
              disabled={loading || Boolean(success)}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Confirm new password</label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={10}
              disabled={loading || Boolean(success)}
            />
          </div>

          <ul className="space-y-1.5 border-l-2 border-slate-200 pl-3 text-xs text-slate-500" aria-label="Password requirements">
            {requirements.map((requirement) => (
              <li key={requirement.label} className={requirement.met ? "text-emerald-700" : undefined}>
                <span aria-hidden="true" className="mr-1.5">{requirement.met ? "✓" : "○"}</span>
                {requirement.label}
              </li>
            ))}
            <li className={categoryCount >= 3 ? "text-emerald-700" : undefined}>
              <span aria-hidden="true" className="mr-1.5">{categoryCount >= 3 ? "✓" : "○"}</span>
              Use at least 3 character types
            </li>
          </ul>

          {success && <p role="status" className="border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{success}</p>}
          {error && <p role="alert" className="border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading || Boolean(success)}
            className="flex w-full items-center justify-center bg-[#0f6cbd] py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(15,108,189,0.22)] transition hover:bg-[#0f548c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
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

/** Wraps reset-password client search-params usage in Suspense for build-time prerender compatibility. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f5f5]" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
