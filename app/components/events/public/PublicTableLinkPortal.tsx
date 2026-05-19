"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type TableStatus = "DRAFT" | "OPEN" | "SUBMITTED" | "LOCKED" | "EVENT_DAY" | "ARCHIVED";

type SeatStatus = "EMPTY" | "RESERVED" | "INVITED" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED";

interface PublicSeatGuest {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface PublicSeat {
  id: string;
  seatNumber: number;
  status: SeatStatus;
  guest?: PublicSeatGuest | null;
}

interface PublicInvite {
  id: string;
  seatId?: string | null;
  inviteEmail?: string | null;
  invitePhone?: string | null;
  status: string;
  createdAt: string;
}

interface PublicTableDetail {
  id: string;
  name: string;
  tableNumber?: number | null;
  tableUid: string;
  publicCode: string;
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
  notes?: string | null;
  status: TableStatus;
  seats: PublicSeat[];
  guestInvites: PublicInvite[];
  event: {
    id: string;
    name: string;
    startDate: string;
  };
}

interface PublicTableLinkPortalProps {
  eventId?: string;
  tableUid?: string;
}

/** PublicTableLinkPortal provides a host-facing TableLink login and roster workflow. */
export default function PublicTableLinkPortal({ eventId, tableUid }: PublicTableLinkPortalProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tokenFromQuery = searchParams.get("token") ?? "";
  const eventIdFromQuery = searchParams.get("eventId") ?? "";
  const tableKeyFromQuery = searchParams.get("tableKey") ?? "";

  const [eventIdInput, setEventIdInput] = useState(eventId ?? eventIdFromQuery);
  const [tableKeyInput, setTableKeyInput] = useState(tableUid ?? tableKeyFromQuery);
  const [emailInput, setEmailInput] = useState("");

  const [token, setToken] = useState(tokenFromQuery);
  const [detail, setDetail] = useState<PublicTableDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hostName, setHostName] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSeatId, setInviteSeatId] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const hasPortalTarget = Boolean(eventId && tableUid);
  const portalBasePath = hasPortalTarget
    ? `/api/events/public/tablelink/${encodeURIComponent(eventId as string)}/${encodeURIComponent(tableUid as string)}`
    : "";
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";

  const seatSummary = useMemo(() => {
    if (!detail) return { total: 0, filled: 0, open: 0 };
    const total = detail.seats.length;
    const filled = detail.seats.filter((seat) => Boolean(seat.guest)).length;
    return { total, filled, open: Math.max(0, total - filled) };
  }, [detail]);

  useEffect(() => {
    setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  useEffect(() => {
    if (!eventId && eventIdFromQuery) setEventIdInput(eventIdFromQuery);
    if (!tableUid && tableKeyFromQuery) setTableKeyInput(tableKeyFromQuery);
  }, [eventId, eventIdFromQuery, tableKeyFromQuery, tableUid]);

  useEffect(() => {
    if (!detail) return;
    setHostName(detail.hostName ?? "");
    setHostPhone(detail.hostPhone ?? "");
    setNotes(detail.notes ?? "");
  }, [detail]);

  useEffect(() => {
    if (!hasPortalTarget || !token) return;
    void loadTableDetail();
  }, [hasPortalTarget, token, eventId, tableUid]);

  async function requestAccess() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/events/public/tablelink/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventIdInput.trim(),
          tableKey: tableKeyInput.trim(),
          email: emailInput.trim().toLowerCase(),
        }),
      });
      const payload = (await response.json()) as {
        token?: string;
        eventId?: string;
        tableUid?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.token || !payload.eventId || !payload.tableUid) {
        throw new Error(payload.error?.message ?? "Unable to request access.");
      }

      setToken(payload.token);
      setMessage("Access granted. Opening your TableLink workspace...");
      router.push(`/tablelink/${payload.eventId}/${payload.tableUid}?token=${encodeURIComponent(payload.token)}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request access.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTableDetail() {
    if (!eventId || !tableUid || !token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${portalBasePath}${tokenQuery}`, { cache: "no-store" });
      const payload = (await response.json()) as PublicTableDetail | { error?: { message?: string } };
      if (!response.ok || !("id" in payload)) {
        throw new Error((payload as { error?: { message?: string } }).error?.message ?? "Unable to load table details.");
      }
      setDetail(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load table details.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveHostDetails() {
    if (!eventId || !tableUid || !token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${portalBasePath}${tokenQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: hostName.trim() || undefined,
          hostPhone: hostPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to save table details.");
      }
      setMessage("Table details saved.");
      await loadTableDetail();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save table details.");
    } finally {
      setBusy(false);
    }
  }

  async function markSubmitted() {
    if (!eventId || !tableUid || !token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${portalBasePath}${tokenQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to submit table roster.");
      }
      setMessage("Table roster submitted. You can still reopen it later if event staff unlocks the table.");
      await loadTableDetail();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit table roster.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    if (!eventId || !tableUid || !token) return;
    if (!inviteEmail.trim() && !invitePhone.trim()) {
      setError("Enter an email or phone number for the guest invite.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${portalBasePath}/invite-guest${tokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId: inviteSeatId || undefined,
          inviteEmail: inviteEmail.trim() || undefined,
          invitePhone: invitePhone.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { token?: string; error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to create invite.");
      }

      const inviteToken = payload.token;
      if (inviteToken) {
        const inviteLink = `/tablelink/invite/${inviteToken}`;
        setLastInviteLink(inviteLink);
        setMessage(`Invite created. Share this guest link: ${inviteLink}`);
      } else {
        setLastInviteLink(null);
        setMessage("Invite created.");
      }
      setInviteEmail("");
      setInvitePhone("");
      setInviteSeatId("");
      await loadTableDetail();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invite.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasPortalTarget) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_60%)] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">EventSTUDIO TableLink</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Table Host Sign-In</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your Event ID, TableKey, and host email to request your secure table access link.
          </p>

          <div className="mt-5 space-y-3">
            <input
              value={eventIdInput}
              onChange={(event) => setEventIdInput(event.target.value)}
              placeholder="Event ID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={tableKeyInput}
              onChange={(event) => setTableKeyInput(event.target.value)}
              placeholder="TableKey (public code)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="Host email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error ? <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
          {message ? <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p> : null}

          <button
            onClick={() => void requestAccess()}
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {busy ? "Requesting..." : "Request Access"}
          </button>

          <p className="mt-4 text-xs text-slate-500">
            Your link is token-based and expires automatically. Contact event staff if your host email changed.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,_#f8fafc,_#eef2ff_55%,_#ffffff)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">EventSTUDIO TableLink</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Host Table Workspace</h1>
          <p className="mt-1 text-sm text-slate-600">
            {detail ? `${detail.event.name} · ${detail.tableNumber ? `Table #${detail.tableNumber}` : detail.name}` : "Loading table workspace..."}
          </p>
        </div>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading table details...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        {detail ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="Seats" value={seatSummary.total} helper="Total configured" />
              <Metric label="Filled" value={seatSummary.filled} helper="Guests with profile" />
              <Metric label="Open" value={seatSummary.open} helper="Seats still open" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Host Details</h2>
                <p className="mt-1 text-xs text-slate-500">Keep your contact and table notes updated for event staff.</p>
                <div className="mt-3 space-y-2">
                  <input
                    value={hostName}
                    onChange={(event) => setHostName(event.target.value)}
                    placeholder="Host name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={hostPhone}
                    onChange={(event) => setHostPhone(event.target.value)}
                    placeholder="Host phone"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Table notes"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void saveHostDetails()}
                    disabled={busy || detail.status === "LOCKED"}
                    className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    Save Details
                  </button>
                  <button
                    onClick={() => void markSubmitted()}
                    disabled={busy || detail.status === "LOCKED" || detail.status === "SUBMITTED"}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Mark Submitted
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Invite Guests</h2>
                <p className="mt-1 text-xs text-slate-500">Send invite links seat-by-seat or for open seats.</p>
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="Guest email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={invitePhone}
                    onChange={(event) => setInvitePhone(event.target.value)}
                    placeholder="Guest phone"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={inviteSeatId}
                    onChange={(event) => setInviteSeatId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">No seat preference</option>
                    {detail.seats.map((seat) => (
                      <option key={seat.id} value={seat.id}>
                        Seat {seat.seatNumber} ({seat.status})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => void createInvite()}
                  disabled={busy || detail.status === "LOCKED"}
                  className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Create Invite
                </button>
                {lastInviteLink ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Latest invite link:{" "}
                    <Link href={lastInviteLink} className="font-semibold text-blue-700 hover:text-blue-800">
                      {lastInviteLink}
                    </Link>
                  </p>
                ) : null}
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Seat Roster</h2>
              <p className="mt-1 text-xs text-slate-500">Track seats, invite progress, and completed guest details.</p>
              <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Seat</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Guest</th>
                      <th className="px-3 py-2">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.seats.map((seat) => {
                      const guest = seat.guest;
                      const guestName = guest
                        ? `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim() || "Guest"
                        : "Open";
                      return (
                        <tr key={seat.id}>
                          <td className="px-3 py-2 text-slate-700">Seat {seat.seatNumber}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{seat.status}</td>
                          <td className="px-3 py-2 text-slate-700">{guestName}</td>
                          <td className="px-3 py-2 text-slate-700">{guest?.email ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Recent Invites</h2>
              <p className="mt-1 text-xs text-slate-500">Latest 50 invite entries for this table.</p>
              <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.guestInvites.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={3}>No invites yet.</td>
                      </tr>
                    ) : (
                      detail.guestInvites.map((invite) => (
                        <tr key={invite.id}>
                          <td className="px-3 py-2 text-slate-700">{new Date(invite.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-700">{invite.inviteEmail ?? invite.invitePhone ?? "-"}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{invite.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <p className="text-center text-xs text-slate-500">
          Need event workspace access instead? <Link href="/events/events" className="font-semibold text-blue-700 hover:text-blue-800">Open EventSTUDIO registry</Link>.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
