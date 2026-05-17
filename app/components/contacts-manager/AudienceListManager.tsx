/** Saved audience list management tools for Contacts Manager. */
"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employer?: string | null;
}

interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  updatedAt: string;
}

interface AudienceListManagerProps {
  lists: SavedAudienceList[];
  listRecipientsById: Record<string, string[]>;
  constituents: ConstituentRow[];
  onReload: () => Promise<void>;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  onLoadList?: (listId: string) => void;
}

/** AudienceListManager previews, renames, duplicates, merges, and deletes saved audience lists. */
export default function AudienceListManager({
  lists,
  listRecipientsById,
  constituents,
  onReload,
  onMessage,
  onError,
  onLoadList,
}: AudienceListManagerProps) {
  const [activeListId, setActiveListId] = useState(lists[0]?.id ?? "");
  const [checkedListIds, setCheckedListIds] = useState<Set<string>>(new Set());
  const [renameValue, setRenameValue] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [mergeName, setMergeName] = useState("Merged Audience");
  const [saving, setSaving] = useState(false);

  const activeList = lists.find((list) => list.id === activeListId) ?? lists[0] ?? null;
  const activeEmails = activeList ? listRecipientsById[activeList.id] ?? [] : [];
  const contactsByEmail = useMemo(() => {
    return new Map(constituents.map((row) => [row.email?.trim().toLowerCase(), row]).filter(([email]) => Boolean(email)) as Array<[string, ConstituentRow]>);
  }, [constituents]);
  const previewRows = activeEmails.slice(0, 75).map((email) => ({ email, contact: contactsByEmail.get(email) }));
  const selectedLists = lists.filter((list) => checkedListIds.has(list.id));
  const selectedRecipientCount = new Set(selectedLists.flatMap((list) => listRecipientsById[list.id] ?? [])).size;

  async function runAction(action: () => Promise<string>) {
    setSaving(true);
    try {
      const message = await action();
      await onReload();
      onMessage?.(message);
    } catch (requestError) {
      onError?.(requestError instanceof Error ? requestError.message : "Audience list action failed.");
    } finally {
      setSaving(false);
    }
  }

  function toggleChecked(id: string) {
    setCheckedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-lg border border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">Segment Lists</h3>
          <p className="mt-0.5 text-xs text-gray-500">{lists.length} saved lists</p>
        </div>
        <div className="max-h-[62vh] overflow-auto p-2">
          {lists.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-500">No saved lists yet.</p>
          ) : lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => { setActiveListId(list.id); setRenameValue(list.name); setDuplicateName(`${list.name} Copy`); }}
              className={`mb-1 flex w-full items-start gap-2 rounded-lg border p-2 text-left ${activeList?.id === list.id ? "border-green-300 bg-white" : "border-transparent hover:border-gray-200 hover:bg-white"}`}
            >
              <input type="checkbox" checked={checkedListIds.has(list.id)} onChange={() => toggleChecked(list.id)} onClick={(event) => event.stopPropagation()} className="mt-1 rounded border-gray-300 text-green-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">{list.name}</span>
                <span className="block text-xs text-gray-500">{list.recipientsCount} recipients</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{activeList?.name ?? "No list selected"}</h3>
              <p className="mt-1 text-xs text-gray-500">{activeEmails.length} recipients · {previewRows.filter((row) => row.contact).length} matched constituents</p>
            </div>
            {activeList && onLoadList && (
              <button type="button" onClick={() => onLoadList(activeList.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Load in Builder</button>
            )}
          </div>
          <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50 text-left font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Matched Contact</th><th className="px-3 py-2">Organization</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No recipients in this list.</td></tr>
                ) : previewRows.map((row) => (
                  <tr key={row.email}>
                    <td className="px-3 py-2 text-gray-700">{row.email}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.contact ? `${row.contact.firstName} ${row.contact.lastName}`.trim() || "Unnamed" : "Not matched"}</td>
                    <td className="px-3 py-2 text-gray-500">{row.contact?.employer || row.contact?.phone || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <ToolPanel title="Rename List">
            <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder={activeList?.name ?? "List name"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" disabled={!activeList || saving || !renameValue.trim()} onClick={() => activeList && void runAction(async () => {
              await apiFetch(`/api/email-campaigns/lists/${activeList.id}`, { method: "PUT", body: JSON.stringify({ name: renameValue }) });
              return "Audience list renamed.";
            })} className="mt-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Rename</button>
          </ToolPanel>

          <ToolPanel title="Duplicate and Rename">
            <input value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} placeholder={activeList ? `${activeList.name} Copy` : "New list name"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" disabled={!activeList || saving || !duplicateName.trim()} onClick={() => activeList && void runAction(async () => {
              await apiFetch("/api/email-campaigns/lists", { method: "POST", body: JSON.stringify({ name: duplicateName, description: activeList.description ?? "", recipientEmails: activeEmails }) });
              return "Audience list duplicated.";
            })} className="mt-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Duplicate</button>
          </ToolPanel>

          <ToolPanel title="Merge Selected Lists">
            <input value={mergeName} onChange={(event) => setMergeName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-gray-500">{selectedLists.length} lists selected · {selectedRecipientCount} unique recipients</p>
            <button type="button" disabled={selectedLists.length < 2 || saving || !mergeName.trim()} onClick={() => void runAction(async () => {
              const recipientEmails = Array.from(new Set(selectedLists.flatMap((list) => listRecipientsById[list.id] ?? [])));
              await apiFetch("/api/email-campaigns/lists", { method: "POST", body: JSON.stringify({ name: mergeName, description: `Merged from ${selectedLists.map((list) => list.name).join(", ")}`, recipientEmails }) });
              return "Merged audience list created.";
            })} className="mt-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create Merged List</button>
          </ToolPanel>

          <ToolPanel title="Delete List">
            <p className="text-xs text-gray-500">Deletes the selected saved list. Constituents are not deleted.</p>
            <button type="button" disabled={!activeList || saving} onClick={() => activeList && window.confirm(`Delete "${activeList.name}"?`) && void runAction(async () => {
              await apiFetch(`/api/email-campaigns/lists/${activeList.id}`, { method: "DELETE" });
              setActiveListId("");
              return "Audience list deleted.";
            })} className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Delete Selected List</button>
          </ToolPanel>
        </div>
      </section>
    </div>
  );
}

function ToolPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}
