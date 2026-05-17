"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import EmptyStateCard from "@/app/components/ui/EmptyStateCard";
import ActionButton from "@/app/components/ui/ActionButton";
import StewardContextButton from "@/app/components/ai/StewardContextButton";

interface SavedRecipientList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SavedRecipientListDetail {
  id: string;
  name: string;
  description?: string | null;
  recipients: Array<{ id: string; email: string }>;
}

function splitEmails(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function CommunicationsSegmentsPanel() {
  const [lists, setLists] = useState<SavedRecipientList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emailsInput, setEmailsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiFetch<SavedRecipientList[]>("/api/email-campaigns/lists");
      setLists(rows);
      if (!selectedListId && rows.length > 0) {
        setSelectedListId(rows[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved segments.");
    } finally {
      setLoading(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!selectedListId) {
      setName("");
      setDescription("");
      setEmailsInput("");
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        const detail = await apiFetch<SavedRecipientListDetail>(`/api/email-campaigns/lists/${selectedListId}`);
        if (cancelled) return;
        setName(detail.name);
        setDescription(detail.description ?? "");
        setEmailsInput(detail.recipients.map((item) => item.email).join("\n"));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load segment detail.");
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedListId]);

  async function createList() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<SavedRecipientList>("/api/email-campaigns/lists", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          recipientEmails: splitEmails(emailsInput),
        }),
      });
      await loadLists();
      setSelectedListId(created.id);
      setMessage("Segment created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create segment.");
    } finally {
      setSaving(false);
    }
  }

  async function updateList() {
    if (!selectedListId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/email-campaigns/lists/${selectedListId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          description,
          recipientEmails: splitEmails(emailsInput),
        }),
      });
      await loadLists();
      setMessage("Segment updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update segment.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteList() {
    if (!selectedListId) return;
    if (!confirm("Delete this segment list?")) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/email-campaigns/lists/${selectedListId}`, { method: "DELETE" });
      setSelectedListId(null);
      await loadLists();
      setMessage("Segment deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete segment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Saved Segments</h2>
          <Link href="/contacts-manager" className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Open Builder</Link>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading segments...</p>
          ) : lists.length === 0 ? (
            <EmptyStateCard
              className="border-0 bg-transparent px-0 py-4 shadow-none"
              title="No donor segments yet"
              description="Create a segment to group donors by giving history, event attendance, campaign response, or lapse risk."
              actions={(
                <>
                  <ActionButton
                    label="Create Segment"
                    variant="primary"
                    onClick={() => {
                      setSelectedListId(null);
                      setName("");
                      setDescription("");
                      setEmailsInput("");
                    }}
                  />
                  <ActionButton label="Import Donors" variant="secondary" href="/data-tools/import" />
                  <StewardContextButton
                    label="Ask Steward"
                    prompt="We have no donor segments yet. Recommend a starter segmentation strategy for giving history, event attendance, campaign response, and lapse risk."
                    moduleKey="donor"
                    mode="ask"
                    variant="mini"
                  />
                </>
              )}
            />
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedListId === list.id
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="truncate text-sm font-medium text-gray-900">{list.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{list.recipientsCount} recipients</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <h2 className="text-sm font-semibold text-gray-900">Build Segments In Contacts Manager</h2>
          <p className="mt-1 text-xs text-gray-600">Contacts Manager is the canonical place to build lists with side-by-side contact selection, bulk tags, reusable descriptions, and AI context.</p>
          <Link href="/contacts-manager" className="mt-3 inline-flex rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Open Contacts Manager</Link>
        </div>

        <h2 className="mt-4 text-sm font-semibold text-gray-900">
          {selectedList ? "Quick Email-Only Edit" : "Quick Email-Only Segment"}
        </h2>
        <p className="mt-1 text-xs text-gray-500">Use this only for simple pasted email lists. Constituents, tags, and AI segment context should be managed in Contacts Manager.</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Segment name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Major Donor Stewardship"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Description</span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional notes about this segment"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Recipient emails</span>
            <textarea
              value={emailsInput}
              onChange={(event) => setEmailsInput(event.target.value)}
              className="mt-1 h-44 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="one@email.org\nsecond@email.org"
            />
            <p className="mt-1 text-xs text-gray-500">Use one email per line, or comma-separated values.</p>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!selectedList && (
            <ActionButton
              label={saving ? "Saving..." : "Create Segment"}
              variant="primary"
              onClick={() => void createList()}
              disabled={saving || !name.trim()}
            />
          )}

          {selectedList && (
            <>
              <ActionButton
                label={saving ? "Saving..." : "Save Changes"}
                variant="primary"
                onClick={() => void updateList()}
                disabled={saving || !name.trim()}
              />
              <ActionButton
                label="Delete Segment"
                variant="danger"
                onClick={() => void deleteList()}
                disabled={saving}
              />
            </>
          )}
        </div>

        {message && <p className="mt-3 text-xs text-green-700">{message}</p>}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </section>
    </div>
  );
}
