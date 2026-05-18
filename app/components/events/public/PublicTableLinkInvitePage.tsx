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
    if (status === "COMPLETED") return "This invitation has already been completed";
    if (status === "EXPIRED") return "This invitation has expired";
    if (status === "CANCELLED") return "This invitation was cancelled";
    return "Complete your guest details";
  }, [status]);

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
  }, [token]);

  async function submitInvite() {
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
      const refreshResponse = await fetch(`/api/events/public/tablelink/invites/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const refreshed = (await refreshResponse.json()) as InvitePayload;
      if (refreshResponse.ok && refreshed.invite) {
        setPayload(refreshed);
      }
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
              {status === "COMPLETED" && "Your information was already submitted for this invitation."}
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={dietaryRestrictions}
                onChange={(event) => setDietaryRestrictions(event.target.value)}
                placeholder="Dietary restrictions"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                value={specialNeeds}
                onChange={(event) => setSpecialNeeds(event.target.value)}
                placeholder="Accessibility or special needs"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Additional notes"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void submitInvite()}
                disabled={busy}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
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
