/** Public unsubscribe component for one-click donor email unsubscribe flows. */
"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Renders one-click unsubscribe UI for a tokenized public link. */
export default function PublicUnsubscribePage({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [surveyOnly, setSurveyOnly] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setSurveyOnly(null); setError(null);
    fetch(`${API_BASE}/api/email/preferences/${token}`, { signal: controller.signal }).then(async res => { if (!res.ok) throw new Error("This preference link is unavailable."); const value = await res.json(); setSurveyOnly(value.categoryHint === "SURVEY"); }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [token]);
  /** Submits one-click unsubscribe request using the token URL payload. */
  async function unsubscribeAll() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/email/unsubscribe/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: surveyOnly ? "category" : "all" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "Unable to unsubscribe");
      }
      setDone(true);
      setMessage(surveyOnly ? "You have been unsubscribed from survey invitations. Your other email preferences have not changed." : "You have been unsubscribed from marketing and fundraising email sends.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unsubscribe failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Unsubscribe</h1>
        <p className="text-sm text-gray-600">
          {surveyOnly === null ? "Checking this unsubscribe link…" : surveyOnly ? "Stop survey invitations only. Your newsletter, fundraising and other email preferences stay unchanged." : "Use this page to stop marketing and fundraising emails. Transactional notices may still be sent when required."}
        </p>

        <button
          type="button"
          onClick={() => void unsubscribeAll()}
          disabled={busy || done || surveyOnly === null}
          className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Processing..." : done ? "Unsubscribed" : "Unsubscribe Me"}
        </button>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
