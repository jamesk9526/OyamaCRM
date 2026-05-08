/** SettingsResetPanel renders the destructive reset flow for Settings → Security. */
"use client";

import { useState } from "react";
import { apiFetch, setAccessToken } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

interface ResetVerificationResponse {
  /** The 10-digit code the user must type back exactly. */
  code: string;
  /** ISO timestamp indicating when the current code expires. */
  expiresAt: string;
}

/**
 * SettingsResetPanel protects the installation reset behind an admin-only
 * two-step confirmation flow and then sends the user back to `/setup`.
 */
export default function SettingsResetPanel() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [typedCode, setTypedCode] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const codeMatches = typedCode.trim() === verificationCode;
  const resetConfirmed = confirmationText.trim() === "RESET";

  /** Resets the local dialog state after close, completion, or regeneration. */
  function resetDialogState() {
    setDialogOpen(false);
    setVerificationCode("");
    setExpiresAt("");
    setTypedCode("");
    setConfirmationText("");
    setLoadingCode(false);
    setResetting(false);
    setError(null);
  }

  /** Opens the dialog and requests a fresh server-side verification code. */
  async function openDialog() {
    setDialogOpen(true);
    setError(null);
    setTypedCode("");
    setConfirmationText("");
    setLoadingCode(true);

    try {
      const payload = await apiFetch<ResetVerificationResponse>("/api/settings/reset/verification-code");
      setVerificationCode(payload.code);
      setExpiresAt(payload.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the reset verification code.");
    } finally {
      setLoadingCode(false);
    }
  }

  /** Posts the final destructive reset request once both confirmation fields match. */
  async function submitReset() {
    setResetting(true);
    setError(null);

    try {
      await apiFetch("/api/settings/reset", {
        method: "POST",
        body: JSON.stringify({
          verificationCode: typedCode.trim(),
          confirmationText: confirmationText.trim(),
        }),
      });

      // The backend clears the refresh cookie; clear the in-memory token too.
      setAccessToken(null);
      window.location.assign("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset this CRM installation.");
      setResetting(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-red-900">Reset CRM and rerun setup</h2>
          <p className="text-sm text-red-800">
            This wipes the current CRM installation, clears organization data, and sends you back to the first-run setup wizard.
          </p>
          <p className="text-xs text-red-700">
            Use this only when you intentionally want to start over. The reset clears the current installation history and cannot be undone.
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Only admins can generate a reset code and run this installation reset.
          </div>
        )}

        <button
          type="button"
          onClick={openDialog}
          disabled={!isAdmin}
          className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          Generate reset code
        </button>
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Confirm CRM reset</h3>
              <p className="mt-1 text-sm text-gray-500">
                Type the generated 10-digit code, then type <span className="font-semibold text-gray-900">RESET</span> to continue.
              </p>
            </div>

            <div className="space-y-5 px-6 py-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1 — Verification code</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-lg font-semibold tracking-[0.24em] text-gray-900">
                  {loadingCode ? "Generating..." : verificationCode}
                </div>
                {expiresAt && (
                  <p className="text-xs text-gray-500">Code expires at {new Date(expiresAt).toLocaleString()}.</p>
                )}
                <label className="block text-sm text-gray-600">
                  Type the code shown above
                  <input
                    value={typedCode}
                    onChange={(event) => setTypedCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0000000000"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2 — Final confirmation</p>
                <label className="block text-sm text-gray-600">
                  Type RESET
                  <input
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="RESET"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                This action deletes the current installation data and redirects you to <code className="rounded bg-red-100 px-1 py-0.5">/setup</code>.
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={resetDialogState}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReset}
                disabled={loadingCode || resetting || !codeMatches || !resetConfirmed}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {resetting ? "Resetting..." : "Reset CRM and open setup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
