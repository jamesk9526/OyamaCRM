// Persisted internal message center for OyamaHRM.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveHrmMessage,
  fetchHrmMessages,
  fetchHrmPeople,
  markHrmMessageRead,
  sendHrmMessage,
} from "@/app/lib/hrm/api";
import type { HrmMessageRecord } from "@/app/lib/hrm/types";

type MessageFolder = "inbox" | "sent" | "announcements";
type RecipientMode = "user" | "role" | "broadcast";

interface MessageFormState {
  title: string;
  body: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  kind: "DIRECT" | "ANNOUNCEMENT";
  recipientMode: RecipientMode;
  recipientUserId: string;
  recipientRole: string;
}

const EMPTY_FORM: MessageFormState = {
  title: "",
  body: "",
  priority: "NORMAL",
  kind: "DIRECT",
  recipientMode: "broadcast",
  recipientUserId: "",
  recipientRole: "",
};

/** Formats one date-time value into a local timestamp label. */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** HrmMessagesPage renders inbox, announcements, and sent folders from persisted message APIs. */
export default function HrmMessagesPage() {
  const [folder, setFolder] = useState<MessageFolder>("inbox");
  const [messages, setMessages] = useState<HrmMessageRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<MessageFormState>(EMPTY_FORM);
  const [recipientOptions, setRecipientOptions] = useState<Array<{ userId: string; fullName: string; email: string | null }>>([]);

  /** Loads one message folder and unread count from the HRM message endpoint. */
  const loadMessages = useCallback(async (selectedFolder: MessageFolder) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchHrmMessages(selectedFolder);
      setMessages(response.items);
      setUnreadCount(response.unreadCount);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load HRM messages.");
      setMessages([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Loads active user recipients from the HRM people directory for direct message composition. */
  const loadRecipients = useCallback(async () => {
    try {
      const people = await fetchHrmPeople({ status: "active" });
      const rows = people.items
        .filter((person) => Boolean(person.userId))
        .map((person) => ({
          userId: person.userId as string,
          fullName: person.fullName,
          email: person.email,
        }));
      setRecipientOptions(rows);
    } catch {
      setRecipientOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadMessages(folder);
  }, [folder, loadMessages]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const availableRoles = useMemo(() => ["admin", "manager", "staff", "readonly", "report_viewer"], []);

  /** Sends one internal HRM message based on the current compose form values. */
  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Message title and body are required.");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        kind: form.kind,
        broadcastAll: form.recipientMode === "broadcast",
        recipientUserId: form.recipientMode === "user" ? (form.recipientUserId || undefined) : undefined,
        recipientRole: form.recipientMode === "role" ? (form.recipientRole || undefined) : undefined,
      };

      await sendHrmMessage(payload);
      setSuccess("Message sent.");
      setForm({ ...EMPTY_FORM, kind: form.kind, priority: form.priority, recipientMode: form.recipientMode });
      await loadMessages(folder);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  /** Marks one inbox message as read and refreshes the active folder list. */
  async function onMarkRead(messageId: string) {
    try {
      await markHrmMessageRead(messageId);
      await loadMessages(folder);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to mark message read.");
    }
  }

  /** Archives one sent message from the active organization message queue. */
  async function onArchive(messageId: string) {
    try {
      await archiveHrmMessage(messageId);
      await loadMessages(folder);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to archive message.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Internal Messages</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">HRM Communications Center</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          Persisted internal communication channels for staff-to-staff operations, role notices, and organization-wide HRM announcements.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Current Folder</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{folder}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Unread Inbox</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">{loading ? "..." : unreadCount}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Visible Messages</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : messages.length}</p>
        </article>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFolder("inbox")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${folder === "inbox" ? "bg-teal-600 text-white" : "border border-teal-200 text-teal-700 hover:bg-teal-50"}`}
          >
            Inbox
            {unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setFolder("sent")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${folder === "sent" ? "bg-teal-600 text-white" : "border border-teal-200 text-teal-700 hover:bg-teal-50"}`}
          >
            Sent
          </button>
          <button
            type="button"
            onClick={() => setFolder("announcements")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${folder === "announcements" ? "bg-teal-600 text-white" : "border border-teal-200 text-teal-700 hover:bg-teal-50"}`}
          >
            Announcements
          </button>
          <button
            type="button"
            onClick={() => void loadMessages(folder)}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Compose Message</h2>

        <form onSubmit={submitMessage} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kind</label>
              <select
                value={form.kind}
                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as "DIRECT" | "ANNOUNCEMENT" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="DIRECT">DIRECT</option>
                <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recipient Mode</label>
              <select
                value={form.recipientMode}
                onChange={(event) => setForm((current) => ({ ...current, recipientMode: event.target.value as RecipientMode }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="broadcast">Broadcast to all</option>
                <option value="role">Role</option>
                <option value="user">Direct user</option>
              </select>
            </div>
            <div>
              {form.recipientMode === "user" ? (
                <>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Recipient User</label>
                  <select
                    value={form.recipientUserId}
                    onChange={(event) => setForm((current) => ({ ...current, recipientUserId: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select user</option>
                    {recipientOptions.map((option) => (
                      <option key={option.userId} value={option.userId}>{option.fullName}{option.email ? ` (${option.email})` : ""}</option>
                    ))}
                  </select>
                </>
              ) : form.recipientMode === "role" ? (
                <>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Recipient Role</label>
                  <select
                    value={form.recipientRole}
                    onChange={(event) => setForm((current) => ({ ...current, recipientRole: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select role</option>
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Recipient Scope</label>
                  <input value="All HRM users" readOnly className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600" />
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{folder.charAt(0).toUpperCase() + folder.slice(1)} Messages</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages in this folder.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <article key={message.id} className={`rounded-lg border p-3 ${message.readAt ? "border-gray-200 bg-gray-50" : "border-teal-200 bg-teal-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{message.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      From {message.sender.firstName} {message.sender.lastName}
                      {message.recipient ? ` • To ${message.recipient.firstName} ${message.recipient.lastName}` : ""}
                      {message.broadcastAll ? " • Broadcast" : ""}
                      {message.recipientRole ? ` • Role ${message.recipientRole}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{message.priority}</p>
                    <p className="text-[11px] text-gray-500">{formatDateTime(message.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{message.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {folder === "inbox" && !message.readAt ? (
                    <button
                      type="button"
                      onClick={() => void onMarkRead(message.id)}
                      className="rounded border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                    >
                      Mark Read
                    </button>
                  ) : null}
                  {folder === "sent" ? (
                    <button
                      type="button"
                      onClick={() => void onArchive(message.id)}
                      className="rounded border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
