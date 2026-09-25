"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface InvitePayload {
  invite: {
    id: string;
    status: "CREATED" | "QUEUED" | "SENT" | "OPENED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
    inviteEmail?: string | null;
    invitePhone?: string | null;
    openedAt?: string | null;
    completedAt?: string | null;
    expiresAt?: string | null;
    event: {
      id: string;
      name: string;
      startDate: string;
    };
    table: {
      id: string;
      name: string;
      tableUid: string;
      publicCode: string;
    };
    seat?: {
      id: string;
      seatNumber: number;
      status: string;
    } | null;
    guest?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  };
}

interface PublicTableLinkInvitePageProps {
  token: string;
}

/** Public guest self-entry page for a single invite token. */
export default function PublicTableLinkInvitePage({ token }: PublicTableLinkInvitePageProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [notes, setNotes] = useState("");

  const status = payload?.invite.status;
  const isFinalState = status === "COMPLETED" || status === "EXPIRED" || status === "CANCELLED";

  const stateTitle = useMemo(() => {
    if (!status) return "Loading invitation";
    if (status === "COMPLETED") return message ? "Guest details submitted" : "This invitation has already been completed";
    if (status === "EXPIRED") return "This invitation has expired";
    if (status === "CANCELLED") return "This invitation was cancelled";
    return "Complete your guest details";
  }, [message, status]);

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/events/public/tablelink/invites/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as InvitePayload | { error?: { message?: string } };
        if (!response.ok || !("invite" in data)) {
          throw new Error((data as { error?: { message?: string } }).error?.message ?? "Unable to load invitation.");
        }

        if (!active) return;
        setPayload(data);
        const existingGuest = data.invite.guest;
        setFirstName(existingGuest?.firstName ?? "");
        setLastName(existingGuest?.lastName ?? "");
        setEmail(existingGuest?.email ?? data.invite.inviteEmail ?? "");
        setPhone(existingGuest?.phone ?? data.invite.invitePhone ?? "");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load invitation.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInvite();

    return () => {
      active = false;
    };
  }, [token, loadAttempt]);

  async function submitInvite() {
    if (!firstName.trim() || !lastName.trim() || (!email.trim() && !phone.trim())) {
      setError("Enter your first and last name, plus an email address or phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/events/public/tablelink/invites/${encodeURIComponent(token)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          dietaryRestrictions: dietaryRestrictions.trim() || undefined,
          specialNeeds: specialNeeds.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to complete invitation.");
      }

      setMessage("Thank you. Your guest profile has been submitted.");
      setPayload((current) => current ? { invite: { ...current.invite, status: "COMPLETED" } } : current);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to complete invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_62%)] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">EventSTUDIO Guest Invite</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Loading invitation...</h1>
        </section>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_62%)] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">EventSTUDIO Guest Invite</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Invite unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error ?? "This invite could not be found."}</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-5 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">Try again</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(165deg,_#eff6ff,_#ffffff_62%,_#f8fafc)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">EventSTUDIO Guest Invite</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{stateTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {payload.invite.event.name} · {new Date(payload.invite.event.startDate).toLocaleDateString()} · {payload.invite.table.name}
            {payload.invite.seat ? ` · Seat ${payload.invite.seat.seatNumber}` : ""}
          </p>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        {isFinalState ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-700">
              {status === "COMPLETED" && (message ? "Your guest details are saved for this invitation." : "Your information was already submitted for this invitation.")}
              {status === "EXPIRED" && "This invitation link has expired. Please contact your table host or event organizer."}
              {status === "CANCELLED" && "This invitation was cancelled by the organizer."}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Need help? Contact your event host for a new invite link.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Guest Information</h2>
            <p className="mt-1 text-xs text-slate-500">Please complete your details so the host can finalize their table roster.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-800">First name <span aria-hidden="true">*</span><input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
                className="mt-1 w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800">Last name <span aria-hidden="true">*</span><input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
                className="mt-1 w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800">Email <span className="font-normal text-slate-500">(email or phone required)</span><input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1 w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800">Phone<input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                className="mt-1 w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800 sm:col-span-2">Dietary restrictions <span className="font-normal text-slate-500">(optional)</span><textarea
                value={dietaryRestrictions}
                onChange={(event) => setDietaryRestrictions(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800 sm:col-span-2">Accessibility needs <span className="font-normal text-slate-500">(optional)</span><textarea
                value={specialNeeds}
                onChange={(event) => setSpecialNeeds(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
              <label className="text-sm font-medium text-slate-800 sm:col-span-2">Additional notes <span className="font-normal text-slate-500">(optional)</span><textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-blue-700 focus:outline-none"
              /></label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void submitInvite()}
                disabled={busy || !firstName.trim() || !lastName.trim() || (!email.trim() && !phone.trim())}
                className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
              >
                {busy ? "Submitting..." : "Submit Guest Details"}
              </button>
              <Link href="/tablelink" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                Back to TableLink sign-in
              </Link>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
