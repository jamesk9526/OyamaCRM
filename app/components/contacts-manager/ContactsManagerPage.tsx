/** Shared audience list manager for email campaigns and printable letter workflows. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  type: string;
  donorStatus: string;
  totalLifetimeGiving?: number | string | null;
  tags?: Array<{ tag: { name: string; color: string } }>;
}

interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  updatedAt: string;
}

interface SavedAudienceDetail {
  id: string;
  name: string;
  description?: string | null;
  recipients: Array<{ id: string; email: string; firstName?: string | null; lastName?: string | null }>;
}

type ContactFilter = "ALL" | "DONORS" | "NON_DONORS" | "MISSING_EMAIL";

/** ContactsManagerPage gives staff one place to build reusable audiences for email and print workflows. */
export default function ContactsManagerPage() {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [lists, setLists] = useState<SavedAudienceList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("ALL");
  const [listName, setListName] = useState("");
  const [description, setDescription] = useState("");
  const [externalEmails, setExternalEmails] = useState("");
  const [tagEditor, setTagEditor] = useState<{ constituent: ConstituentRow; tags: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedList = useMemo(() => lists.find((list) => list.id === selectedListId) ?? null, [lists, selectedListId]);

  const filteredConstituents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return constituents.filter((row) => {
      const isDonor = row.type === "DONOR" || Number(row.totalLifetimeGiving ?? 0) > 0 || row.donorStatus === "ACTIVE" || row.donorStatus === "MAJOR_DONOR";
      if (filter === "DONORS" && !isDonor) return false;
      if (filter === "NON_DONORS" && isDonor) return false;
      if (filter === "MISSING_EMAIL" && row.email) return false;
      if (!query) return true;
      const haystack = [
        row.firstName,
        row.lastName,
        row.email ?? "",
        row.phone ?? "",
        row.type,
        row.donorStatus,
        ...(row.tags?.map((item) => item.tag.name) ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [constituents, filter, search]);

  const selectedRows = useMemo(() => constituents.filter((row) => selectedIds.has(row.id)), [constituents, selectedIds]);
  const selectedEmails = useMemo(() => selectedRows.map((row) => row.email?.trim().toLowerCase()).filter(Boolean) as string[], [selectedRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactRows, listRows] = await Promise.all([
        apiFetch<ConstituentRow[]>("/api/constituents?limit=500"),
        apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
      ]);
      setConstituents(contactRows);
      setLists(listRows);
      if (!selectedListId && listRows.length > 0) setSelectedListId(listRows[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load contacts manager.");
    } finally {
      setLoading(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedListId) {
      setListName("");
      setDescription("");
      setExternalEmails("");
      return;
    }

    let cancelled = false;
    async function loadListDetail() {
      try {
        const detail = await apiFetch<SavedAudienceDetail>(`/api/email-campaigns/lists/${selectedListId}`);
        if (cancelled) return;
        setListName(detail.name);
        setDescription(detail.description ?? "");
        setExternalEmails(detail.recipients.map((row) => row.email).join("\n"));
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Failed to load audience list.");
      }
    }
    void loadListDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedListId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds(new Set(filteredConstituents.map((row) => row.id)));
  }

  function startNewList() {
    setSelectedListId(null);
    setListName("");
    setDescription("");
    setExternalEmails("");
    setSelectedIds(new Set());
    setMessage(null);
    setError(null);
  }

  async function saveList() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const recipientEmails = Array.from(new Set([...selectedEmails, ...splitEmails(externalEmails)]));
      const payload = {
        name: listName,
        description,
        recipientEmails,
      };

      const saved = selectedListId
        ? await apiFetch<SavedAudienceList>(`/api/email-campaigns/lists/${selectedListId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch<SavedAudienceList>("/api/email-campaigns/lists", { method: "POST", body: JSON.stringify(payload) });

      setSelectedListId(saved.id);
      await load();
      setMessage(`Audience list saved with ${recipientEmails.length} recipient emails.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save audience list.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTags() {
    if (!tagEditor) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/constituents/${tagEditor.constituent.id}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagNames: splitTags(tagEditor.tags) }),
      });
      setTagEditor(null);
      await load();
      setMessage("Contact tags updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update tags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Contacts Manager</h1>
            <p className="mt-1 text-sm text-gray-500">Build reusable audiences for email campaigns, newsletters, announcements, and printable mailings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/communications" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Open Email Projects</Link>
            <Link href="/letters-printables" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Open Printables</Link>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts, tags, email, phone..." className="min-w-60 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as ContactFilter)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="ALL">All contacts</option>
              <option value="DONORS">Donors</option>
              <option value="NON_DONORS">Non-donors</option>
              <option value="MISSING_EMAIL">Missing email</option>
            </select>
            <button type="button" onClick={selectVisible} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Select Visible</button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Tags</th>
                  <th className="px-3 py-3">Giving</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Loading contacts...</td></tr>
                ) : filteredConstituents.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No contacts match this view.</td></tr>
                ) : filteredConstituents.map((row) => (
                  <tr key={row.id} className={selectedIds.has(row.id) ? "bg-green-50/50" : "bg-white"}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} className="h-4 w-4 rounded border-gray-300 text-green-600" /></td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-900">{row.firstName} {row.lastName}</p>
                      <p className="text-xs text-gray-500">{row.email || row.phone || "No email or phone"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{row.type.replaceAll("_", " ")}</span>
                      <p className="mt-1 text-xs text-gray-500">{row.donorStatus.replaceAll("_", " ")}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(row.tags ?? []).length === 0 ? <span className="text-xs text-gray-400">No tags</span> : row.tags?.map((entry) => (
                          <span key={entry.tag.name} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${entry.tag.color}22`, color: entry.tag.color }}>{entry.tag.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{formatMoney(row.totalLifetimeGiving)} lifetime</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setTagEditor({ constituent: row, tags: row.tags?.map((entry) => entry.tag.name).join(", ") ?? "" })} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Tags</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Audience Lists</h2>
              <button type="button" onClick={startNewList} className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">New</button>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {lists.map((list) => (
                <button key={list.id} type="button" onClick={() => setSelectedListId(list.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${selectedListId === list.id ? "border-green-300 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <p className="truncate text-sm font-semibold text-gray-900">{list.name}</p>
                  <p className="text-xs text-gray-500">{list.recipientsCount} recipients</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{selectedList ? "Edit Audience" : "Create Audience"}</h2>
            <div className="mt-3 space-y-3">
              <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Newsletter Audience" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <textarea value={externalEmails} onChange={(event) => setExternalEmails(event.target.value)} rows={7} placeholder="External/non-donor emails, one per line" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                Selected constituents with email: <span className="font-semibold text-gray-900">{selectedEmails.length}</span>. External emails: <span className="font-semibold text-gray-900">{splitEmails(externalEmails).length}</span>.
              </div>
              <button type="button" onClick={() => void saveList()} disabled={saving || !listName.trim()} className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : "Save Audience List"}</button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600">
            <h2 className="text-sm font-semibold text-gray-900">Donor / Non-Donor Tagging</h2>
            <p className="mt-2">Use constituent type plus tags like Donor, Non-Donor, Volunteer, Newsletter, Board, or Prospect. The import mapper already supports a Tags / Keywords field, and this manager can update tags after import.</p>
          </section>
        </aside>
      </div>

      {tagEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900">Edit Tags</h2>
            <p className="mt-1 text-xs text-gray-500">{tagEditor.constituent.firstName} {tagEditor.constituent.lastName}</p>
            <textarea value={tagEditor.tags} onChange={(event) => setTagEditor({ ...tagEditor, tags: event.target.value })} rows={5} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Donor, Newsletter, Volunteer" />
            <p className="mt-1 text-xs text-gray-500">Separate tags with commas or line breaks.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTagEditor(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => void saveTags()} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">Save Tags</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function splitEmails(value: string): string[] {
  return value.split(/[\n,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function splitTags(value: string): string[] {
  return value.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean);
}

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";
}
