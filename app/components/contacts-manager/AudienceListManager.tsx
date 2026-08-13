/** Saved audience list management tools for Contacts Manager. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employer?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  tags?: Array<{ tag: { name: string; color?: string | null } }>;
}

interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  updatedAt: string;
}

export interface SavedAudienceMember {
  id: string;
  constituentId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface AudienceListManagerProps {
  lists: SavedAudienceList[];
  listRecipientsById: Record<string, SavedAudienceMember[]>;
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
  const [memberSearch, setMemberSearch] = useState("");
  const [churchTagFilter, setChurchTagFilter] = useState<"ANY" | "INCLUDE" | "EXCLUDE">("ANY");
  const [checkedMemberIds, setCheckedMemberIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const activeList = lists.find((list) => list.id === activeListId) ?? lists[0] ?? null;
  const activeMembers = activeList ? listRecipientsById[activeList.id] ?? [] : [];
  const contactsByEmail = useMemo(() => {
    return new Map(constituents.map((row) => [row.email?.trim().toLowerCase(), row]).filter(([email]) => Boolean(email)) as Array<[string, ConstituentRow]>);
  }, [constituents]);
  const contactsById = useMemo(() => new Map(constituents.map((row) => [row.id, row])), [constituents]);
  const memberRows = activeMembers.map((member) => ({
    member,
    contact: member.constituentId ? contactsById.get(member.constituentId) : contactsByEmail.get(member.email?.trim().toLowerCase() ?? ""),
  }));
  const visibleMemberRows = memberRows.filter((row) => {
    const query = memberSearch.trim().toLowerCase();
    const hasChurchTag = row.contact?.tags?.some((entry) => entry.tag.name.trim().toLowerCase().includes("church")) ?? false;
    if (churchTagFilter === "INCLUDE" && !hasChurchTag) return false;
    if (churchTagFilter === "EXCLUDE" && hasChurchTag) return false;
    if (!query) return true;
    return [
      row.member.email,
      row.member.firstName,
      row.member.lastName,
      row.contact?.firstName,
      row.contact?.lastName,
      row.contact?.email,
      row.contact?.addressLine1,
      row.contact?.addressLine2,
      row.contact?.city,
      row.contact?.state,
      row.contact?.zip,
      row.contact?.employer,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const selectedLists = lists.filter((list) => checkedListIds.has(list.id));
  const selectedRecipientCount = new Set(selectedLists.flatMap((list) => (listRecipientsById[list.id] ?? []).map((member) => member.constituentId ? `constituent:${member.constituentId}` : `email:${member.email?.trim().toLowerCase() ?? member.id}`))).size;
  const allVisibleMembersChecked = visibleMemberRows.length > 0 && visibleMemberRows.every((row) => checkedMemberIds.has(row.member.id));

  useEffect(() => {
    setCheckedMemberIds(new Set());
    setMemberSearch("");
    setChurchTagFilter("ANY");
  }, [activeList?.id]);

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

  async function removeMember(member: SavedAudienceMember) {
    if (!activeList) return;
    await runAction(async () => {
      await apiFetch(`/api/email-campaigns/lists/${activeList.id}/recipients/${member.id}`, { method: "DELETE" });
      return `Removed ${memberDisplayName(member)} from the saved base list.`;
    });
  }

  function toggleMember(memberId: string) {
    setCheckedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function toggleVisibleMembers() {
    setCheckedMemberIds((current) => {
      const next = new Set(current);
      if (allVisibleMembersChecked) visibleMemberRows.forEach((row) => next.delete(row.member.id));
      else visibleMemberRows.forEach((row) => next.add(row.member.id));
      return next;
    });
  }

  async function removeCheckedMembers() {
    if (!activeList || checkedMemberIds.size === 0) return;
    const count = checkedMemberIds.size;
    await runAction(async () => {
      await apiFetch(`/api/email-campaigns/lists/${activeList.id}/recipients/remove`, {
        method: "POST",
        body: JSON.stringify({ memberIds: Array.from(checkedMemberIds) }),
      });
      setCheckedMemberIds(new Set());
      return `Removed ${count} selected member${count === 1 ? "" : "s"} from the saved base list.`;
    });
  }

  async function removeAllMembers() {
    if (!activeList || activeMembers.length === 0) return;
    if (!window.confirm(`Remove all ${activeMembers.length} people from "${activeList.name}"? The saved list will remain, but it will be empty.`)) return;
    await runAction(async () => {
      await apiFetch(`/api/email-campaigns/lists/${activeList.id}/recipients/remove`, {
        method: "POST",
        body: JSON.stringify({ removeAll: true }),
      });
      setCheckedMemberIds(new Set());
      return `Removed all members from ${activeList.name}.`;
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
              <p className="mt-1 text-xs text-gray-500">{activeMembers.length} recipients · {memberRows.filter((row) => row.contact).length} matched constituents</p>
            </div>
            {activeList && onLoadList && (
              <button type="button" onClick={() => onLoadList(activeList.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Edit in Segment Builder</button>
            )}
          </div>
          {activeList ? (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              This is the saved base list used by communications and print workflows. Removing a person here updates that list immediately.
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
            <label className="block text-xs font-semibold text-gray-700">
              Find a list member
              <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search name, email, or organization" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Church tags
              <select value={churchTagFilter} onChange={(event) => setChurchTagFilter(event.target.value as typeof churchTagFilter)} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm font-normal">
                <option value="ANY">Include and exclude</option>
                <option value="INCLUDE">Include Church tags</option>
                <option value="EXCLUDE">Exclude Church tags</option>
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input type="checkbox" checked={allVisibleMembersChecked} onChange={toggleVisibleMembers} disabled={visibleMemberRows.length === 0} className="rounded border-gray-300 text-green-600" />
              Select all shown ({visibleMemberRows.length})
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void removeCheckedMembers()} disabled={saving || checkedMemberIds.size === 0} className="min-h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Remove selected ({checkedMemberIds.size})</button>
              <button type="button" onClick={() => void removeAllMembers()} disabled={saving || activeMembers.length === 0} className="min-h-9 rounded-md bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">Remove all</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Closed accounts are always excluded system-wide and cannot be added to a saved list.</p>
          <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50 text-left font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Matched Contact</th><th className="px-3 py-2">Street address</th><th className="px-3 py-2">Organization</th><th className="px-3 py-2 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleMemberRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">{activeMembers.length === 0 ? "No recipients in this list." : "No list members match these filters."}</td></tr>
                ) : visibleMemberRows.map((row) => (
                  <tr key={row.member.id}>
                    <td className="px-3 py-2"><input type="checkbox" checked={checkedMemberIds.has(row.member.id)} onChange={() => toggleMember(row.member.id)} aria-label={`Select ${memberDisplayName(row.member)} for removal`} className="rounded border-gray-300 text-red-600" /></td>
                    <td className="px-3 py-2 text-gray-700">{row.member.email || row.contact?.email || <span className="text-gray-400">No email</span>}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.contact ? `${row.contact.firstName} ${row.contact.lastName}`.trim() || "Unnamed" : "Not matched"}</td>
                    <td className="px-3 py-2 text-gray-600">{row.contact ? formatMemberAddress(row.contact) || "No street address" : "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{row.contact?.employer || row.contact?.phone || ""}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => void removeMember(row.member)} disabled={saving} className="rounded-md border border-red-200 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Remove ${memberDisplayName(row.member)} from ${activeList?.name ?? "saved list"}`}>Remove</button>
                    </td>
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
              const members = listRecipientsById[activeList.id] ?? [];
              await apiFetch("/api/email-campaigns/lists", { method: "POST", body: JSON.stringify({
                name: duplicateName,
                description: activeList.description ?? "",
                recipientConstituentIds: members.flatMap((member) => member.constituentId ? [member.constituentId] : []),
                recipientEmails: members.flatMap((member) => !member.constituentId && member.email ? [member.email] : []),
              }) });
              return "Audience list duplicated.";
            })} className="mt-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Duplicate</button>
          </ToolPanel>

          <ToolPanel title="Merge Selected Lists">
            <input value={mergeName} onChange={(event) => setMergeName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-gray-500">{selectedLists.length} lists selected · {selectedRecipientCount} unique recipients</p>
            <button type="button" disabled={selectedLists.length < 2 || saving || !mergeName.trim()} onClick={() => void runAction(async () => {
              const members = selectedLists.flatMap((list) => listRecipientsById[list.id] ?? []);
              await apiFetch("/api/email-campaigns/lists", { method: "POST", body: JSON.stringify({
                name: mergeName,
                description: `Merged from ${selectedLists.map((list) => list.name).join(", ")}`,
                recipientConstituentIds: Array.from(new Set(members.flatMap((member) => member.constituentId ? [member.constituentId] : []))),
                recipientEmails: Array.from(new Set(members.flatMap((member) => !member.constituentId && member.email ? [member.email] : []))),
              }) });
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

function formatMemberAddress(row: ConstituentRow): string {
  const street = [row.addressLine1, row.addressLine2].filter(Boolean).join(", ");
  const locality = [row.city, [row.state, row.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(" · ");
}

function ToolPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function memberDisplayName(member: SavedAudienceMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.email || "recipient";
}
