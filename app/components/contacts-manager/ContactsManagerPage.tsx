/** Shared audience and tag manager for email campaigns and printable letter workflows. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employer?: string | null;
  occupation?: string | null;
  type: string;
  donorStatus: string;
  totalLifetimeGiving?: number | string | null;
  tags?: Array<{ tag: { name: string; color: string } }>;
}

interface TagCatalogItem {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  constituentsCount: number;
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

type ContactFilter = "ALL" | "DONORS" | "NON_DONORS" | "ORGANIZATIONS" | "MISSING_EMAIL";
type ContactsModal = "TAGS" | "BULK_TAGS" | null;

interface SegmentRecipe {
  id: string;
  name: string;
  description: string;
  tags: string[];
  matches: (row: ConstituentRow) => boolean;
}

const SEGMENT_RECIPES: SegmentRecipe[] = [
  {
    id: "donors",
    name: "Donors",
    description: "People with giving history or donor status.",
    tags: ["Donor"],
    matches: isDonor,
  },
  {
    id: "churches",
    name: "Churches",
    description: "Church, ministry, chapel, or parish contacts.",
    tags: ["Church", "Organization"],
    matches: (row) => /church|chapel|ministry|parish|congregation/i.test(contactHaystack(row)),
  },
  {
    id: "organizations",
    name: "Organizations",
    description: "Foundation, nonprofit, sponsor, and organization records.",
    tags: ["Organization"],
    matches: (row) => ["ORGANIZATION", "FOUNDATION", "SPONSOR"].includes(row.type),
  },
  {
    id: "businesses",
    name: "Businesses",
    description: "Companies, employers, and business partners.",
    tags: ["Business", "Organization"],
    matches: (row) => /business|company|co\.|inc|llc|ltd|corp|employer/i.test(contactHaystack(row)),
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Contacts with usable email addresses.",
    tags: ["Newsletter"],
    matches: (row) => Boolean(row.email?.trim()),
  },
];

const TAG_COLORS = ["#16a34a", "#2563eb", "#7c3aed", "#dc2626", "#f59e0b", "#64748b"];

/** ContactsManagerPage gives staff one place to build reusable audiences for email and print workflows. */
export default function ContactsManagerPage() {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [tags, setTags] = useState<TagCatalogItem[]>([]);
  const [lists, setLists] = useState<SavedAudienceList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("ALL");
  const [activeTag, setActiveTag] = useState("");
  const [listName, setListName] = useState("");
  const [description, setDescription] = useState("");
  const [externalEmails, setExternalEmails] = useState("");
  const [bulkTagNames, setBulkTagNames] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagDescription, setNewTagDescription] = useState("");
  const [activeModal, setActiveModal] = useState<ContactsModal>(null);
  const [builderOpen, setBuilderOpen] = useState(true);
  const [tagEditor, setTagEditor] = useState<{ constituent: ConstituentRow; tags: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedList = useMemo(() => lists.find((list) => list.id === selectedListId) ?? null, [lists, selectedListId]);

  const filteredConstituents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return constituents.filter((row) => {
      if (filter === "DONORS" && !isDonor(row)) return false;
      if (filter === "NON_DONORS" && isDonor(row)) return false;
      if (filter === "ORGANIZATIONS" && !["ORGANIZATION", "FOUNDATION", "SPONSOR"].includes(row.type)) return false;
      if (filter === "MISSING_EMAIL" && row.email) return false;
      if (activeTag && !row.tags?.some((entry) => entry.tag.name === activeTag)) return false;
      if (!query) return true;
      return contactHaystack(row).toLowerCase().includes(query);
    });
  }, [activeTag, constituents, filter, search]);

  const selectedRows = useMemo(() => constituents.filter((row) => selectedIds.has(row.id)), [constituents, selectedIds]);
  const selectedEmails = useMemo(
    () => selectedRows.map((row) => row.email?.trim().toLowerCase()).filter(Boolean) as string[],
    [selectedRows],
  );
  const viewEmailCount = useMemo(() => filteredConstituents.filter((row) => row.email?.trim()).length, [filteredConstituents]);
  const visibleConstituents = useMemo(() => filteredConstituents.slice(0, 250), [filteredConstituents]);
  const missingSelectedEmails = selectedRows.length - selectedEmails.length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactRows, tagRows, listRows] = await Promise.all([
        apiFetch<ConstituentRow[]>("/api/constituents?limit=2000"),
        apiFetch<TagCatalogItem[]>("/api/constituents/tags/catalog"),
        apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
      ]);
      setConstituents(contactRows);
      setTags(tagRows);
      setLists(listRows);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load contacts manager.");
    } finally {
      setLoading(false);
    }
  }, []);

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
        const emails = detail.recipients.map((row) => row.email.trim().toLowerCase()).filter(Boolean);
        const ids = new Set<string>();
        const matchedEmails = new Set<string>();
        for (const row of constituents) {
          const email = row.email?.trim().toLowerCase();
          if (email && emails.includes(email)) {
            ids.add(row.id);
            matchedEmails.add(email);
          }
        }
        setSelectedIds(ids);
        setExternalEmails(emails.filter((email) => !matchedEmails.has(email)).join("\n"));
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Failed to load audience list.");
      }
    }
    void loadListDetail();
    return () => {
      cancelled = true;
    };
  }, [constituents, selectedListId]);

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function startNewList() {
    setSelectedListId(null);
    setListName("");
    setDescription("");
    setExternalEmails("");
    setSelectedIds(new Set());
    setMessage(null);
    setError(null);
    setBuilderOpen(true);
  }

  function applyRecipe(recipe: SegmentRecipe) {
    const matches = constituents.filter(recipe.matches);
    setSelectedIds(new Set(matches.map((row) => row.id)));
    setListName(recipe.name);
    setDescription(recipe.description);
    setBulkTagNames(recipe.tags.join(", "));
    setActiveTag("");
    setMessage(`${recipe.name} segment selected ${matches.length} constituents.`);
    setBuilderOpen(true);
  }

  function listFromCurrentView() {
    setSelectedIds(new Set(filteredConstituents.map((row) => row.id)));
    setListName(activeTag ? `${activeTag} Audience` : "Filtered Audience");
    setDescription(`Built from Contacts Manager view with ${filteredConstituents.length} matching constituents.`);
    setBuilderOpen(true);
  }

  async function saveList() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const recipientEmails = Array.from(new Set([...selectedEmails, ...splitEmails(externalEmails)]));
      const payload = { name: listName, description, recipientEmails };
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

  async function createTag() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<TagCatalogItem>("/api/constituents/tags/catalog", {
        method: "POST",
        body: JSON.stringify({ name: newTagName, color: newTagColor, description: newTagDescription }),
      });
      setNewTagName("");
      setNewTagDescription("");
      setBulkTagNames(created.name);
      setActiveTag(created.name);
      await load();
      setMessage(`Tag "${created.name}" is ready for segments and AI context.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create tag.");
    } finally {
      setSaving(false);
    }
  }

  async function bulkTagAction(action: "ADD" | "REMOVE") {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const tagNames = splitTags(bulkTagNames);
      await apiFetch("/api/constituents/tags/bulk-actions", {
        method: "POST",
        body: JSON.stringify({ action, constituentIds: Array.from(selectedIds), tagNames }),
      });
      await load();
      setMessage(`${action === "ADD" ? "Added" : "Removed"} ${tagNames.length} tag${tagNames.length === 1 ? "" : "s"} for ${selectedIds.size} selected constituents.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update selected tags.");
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
      setMessage("Constituent tags updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update tags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Outreach", href: "/communications" },
          { label: "Contacts Manager" },
        ]}
        statusLabel="Working"
        metadata={`${constituents.length} constituents | ${lists.length} saved segments | ${tags.length} tags`}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link href="/communications" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Email Projects</Link>
            <Link href="/letters-printables/generate" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Letter Generation</Link>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <WorkspaceRibbon scrollable>
        <WorkspaceRibbonGroup label="Audiences">
          <WorkspaceRibbonButton label="List Builder" onClick={() => setBuilderOpen((value) => !value)} variant="primary" active={builderOpen} title="Show or hide the side-by-side audience list builder" />
          <WorkspaceRibbonButton label="New List" onClick={startNewList} title="Create a new reusable audience list" />
          <WorkspaceRibbonButton label="Use View" onClick={listFromCurrentView} title="Draft an audience list from the current filtered view" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Tags">
          <WorkspaceRibbonButton label="Tag Library" onClick={() => setActiveModal("TAGS")} title="Open tag library and create custom tags" />
          <WorkspaceRibbonButton label="Bulk Tags" onClick={() => setActiveModal("BULK_TAGS")} title="Add or remove tags from selected constituents" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Selection">
          <WorkspaceRibbonButton label={`Select View (${filteredConstituents.length})`} onClick={selectVisible} title="Select every constituent in the current filtered view" />
          <WorkspaceRibbonButton label="Clear" onClick={clearSelection} disabled={selectedIds.size === 0} title="Clear selected constituents" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Open">
          <WorkspaceRibbonButton label="Email Projects" href="/communications" title="Open communications project library" />
          <WorkspaceRibbonButton label="Letter Generation" href="/letters-printables/generate" title="Open letter generation workspace" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Segment Builder</h2>
            <p className="mt-1 text-xs text-gray-500">Start with a common list, refine it with search or tags, then save it once for communications and print workflows.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{constituents.length} constituents</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{selectedIds.size} selected</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{selectedEmails.length} selected emails</span>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {SEGMENT_RECIPES.map((recipe) => (
            <button key={recipe.id} type="button" onClick={() => applyRecipe(recipe)} className="rounded-lg border border-gray-200 p-3 text-left hover:border-green-300 hover:bg-green-50">
              <span className="text-sm font-semibold text-gray-900">{recipe.name}</span>
              <span className="mt-1 block text-xs text-gray-500">{recipe.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={`grid min-w-0 items-start gap-4 ${builderOpen ? "xl:grid-cols-[minmax(0,1fr)_410px]" : ""}`}>
      <section className="min-w-0 rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search constituents, tags, email, employer..." className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as ContactFilter)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="ALL">All</option>
              <option value="DONORS">Donors</option>
              <option value="NON_DONORS">Non-donors</option>
              <option value="ORGANIZATIONS">Organizations</option>
              <option value="MISSING_EMAIL">Missing email</option>
            </select>
            <select value={activeTag} onChange={(event) => setActiveTag(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Any tag</option>
              {tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
            </select>
          </div>

          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            View: <span className="font-semibold text-gray-900">{filteredConstituents.length}</span> constituents, <span className="font-semibold text-gray-900">{viewEmailCount}</span> with email. Showing <span className="font-semibold text-gray-900">{visibleConstituents.length}</span>; search or filter to narrow large lists.
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-3">Constituent</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Tags</th>
                  <th className="px-3 py-3">Giving</th>
                  <th className="px-3 py-3">Actions</th>
                  <th className="w-16 px-3 py-3 text-right">Add</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Loading constituents...</td></tr>
                ) : filteredConstituents.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No constituents match this view.</td></tr>
                ) : visibleConstituents.map((row) => (
                  <tr key={row.id} className={selectedIds.has(row.id) ? "bg-green-50/50" : "bg-white"}>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-900">{contactName(row)}</p>
                      <p className="text-xs text-gray-500">{row.email || row.phone || "No email or phone"}</p>
                      {row.employer && <p className="text-xs text-gray-400">{row.employer}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{labelFor(row.type)}</span>
                      <p className="mt-1 text-xs text-gray-500">{labelFor(row.donorStatus)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(row.tags ?? []).length === 0 ? <span className="text-xs text-gray-400">No tags</span> : row.tags?.map((entry) => (
                          <button key={entry.tag.name} type="button" onClick={() => setActiveTag(entry.tag.name)} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${entry.tag.color}22`, color: entry.tag.color }}>{entry.tag.name}</button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{formatMoney(row.totalLifetimeGiving)} lifetime</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setTagEditor({ constituent: row, tags: row.tags?.map((entry) => entry.tag.name).join(", ") ?? "" })} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Edit Tags</button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => toggleSelected(row.id)} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${selectedIds.has(row.id) ? "border-green-300 bg-green-100 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`} title={selectedIds.has(row.id) ? "Remove from segment" : "Add to segment"}>
                        {selectedIds.has(row.id) ? "←" : "→"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </section>
      {builderOpen && (
        <aside className="sticky top-4 max-h-[calc(100vh-7rem)] min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">List Builder</h2>
                <p className="mt-1 text-xs text-gray-500">Use the arrow beside a constituent to add them to this segment.</p>
              </div>
              <button type="button" onClick={startNewList} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">New</button>
            </div>
            <select value={selectedListId ?? ""} onChange={(event) => setSelectedListId(event.target.value || null)} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">New segment</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipientsCount})</option>)}
            </select>
          </div>

          <div className="border-b border-gray-200 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bulk tag this segment</h3>
            <textarea value={bulkTagNames} onChange={(event) => setBulkTagNames(event.target.value)} rows={2} placeholder="Donor, Church, Newsletter" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void bulkTagAction("ADD")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">Add Tags</button>
              <button type="button" onClick={() => void bulkTagAction("REMOVE")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Remove</button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Spring Newsletter Audience" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Purpose, criteria, or AI notes" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <textarea value={externalEmails} onChange={(event) => setExternalEmails(event.target.value)} rows={3} placeholder="External emails, one per line" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-gray-50 p-2"><span className="block font-semibold text-gray-900">{selectedRows.length}</span><span className="text-gray-500">selected</span></div>
              <div className="rounded-lg bg-gray-50 p-2"><span className="block font-semibold text-gray-900">{selectedEmails.length}</span><span className="text-gray-500">emails</span></div>
              <div className="rounded-lg bg-gray-50 p-2"><span className="block font-semibold text-gray-900">{missingSelectedEmails}</span><span className="text-gray-500">no email</span></div>
            </div>
            <button type="button" onClick={() => void saveList()} disabled={saving || !listName.trim()} className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : selectedList ? "Update Segment" : "Save Segment"}</button>
          </div>

          <div className="border-t border-gray-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected People</h3>
              <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0} className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50">Clear</button>
            </div>
            <div className="max-h-[28vh] space-y-2 overflow-auto pr-1">
              {selectedRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">No one selected yet. Use the arrows in the contact table.</p>
              ) : selectedRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{contactName(row)}</p>
                    <p className="truncate text-xs text-gray-500">{row.email || "No email"}</p>
                  </div>
                  <button type="button" onClick={() => toggleSelected(row.id)} className="rounded-full border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
      </div>

      {activeModal === "TAGS" && (
        <ContactsManagerModal title="Tag Library" onClose={() => setActiveModal(null)} maxWidthClass="max-w-4xl">
          <p className="text-xs text-gray-500">Descriptions give staff and AI useful context when building segments, letters, and email drafts.</p>
          <div className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            {tags.length === 0 ? <p className="text-xs text-gray-500">No tags yet.</p> : tags.map((tag) => (
              <button key={tag.id} type="button" onClick={() => { setActiveTag(tag.name); setBulkTagNames(tag.name); }} className="rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                {tag.name} ({tag.constituentsCount})
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="New tag name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3">
              {TAG_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setNewTagColor(color)} className={`h-6 w-6 rounded-full border ${newTagColor === color ? "border-gray-900" : "border-white"}`} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />
              ))}
            </div>
          </div>
          <textarea value={newTagDescription} onChange={(event) => setNewTagDescription(event.target.value)} rows={4} placeholder="What this tag means and how AI should interpret it" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setActiveModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Close</button>
            <button type="button" onClick={() => void createTag()} disabled={saving || !newTagName.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">Create Tag</button>
          </div>
        </ContactsManagerModal>
      )}

      {activeModal === "BULK_TAGS" && (
        <ContactsManagerModal title="Bulk Tag Selected" onClose={() => setActiveModal(null)}>
          <p className="text-xs text-gray-500">{selectedIds.size} selected constituents. Use commas or line breaks for multiple tags.</p>
          <textarea value={bulkTagNames} onChange={(event) => setBulkTagNames(event.target.value)} rows={5} placeholder="Donor, Church, Newsletter" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void bulkTagAction("ADD")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">Add Tags</button>
            <button type="button" onClick={() => void bulkTagAction("REMOVE")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Remove Tags</button>
          </div>
        </ContactsManagerModal>
      )}

      {tagEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900">Edit Tags</h2>
            <p className="mt-1 text-xs text-gray-500">{contactName(tagEditor.constituent)}</p>
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

function ContactsManagerModal({
  title,
  children,
  onClose,
  maxWidthClass = "max-w-xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className={`max-h-[90vh] w-full overflow-hidden rounded-xl bg-white shadow-xl ${maxWidthClass}`}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Close</button>
        </div>
        <div className="max-h-[calc(90vh-52px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function splitEmails(value: string): string[] {
  return value.split(/[\n,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function splitTags(value: string): string[] {
  return value.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean);
}

function isDonor(row: ConstituentRow): boolean {
  return row.type === "DONOR" || Number(row.totalLifetimeGiving ?? 0) > 0 || row.donorStatus === "ACTIVE" || row.donorStatus === "MAJOR_DONOR";
}

function contactName(row: ConstituentRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Unnamed constituent";
}

function contactHaystack(row: ConstituentRow): string {
  return [
    row.firstName,
    row.lastName,
    row.email ?? "",
    row.phone ?? "",
    row.employer ?? "",
    row.occupation ?? "",
    row.type,
    row.donorStatus,
    ...(row.tags?.map((item) => item.tag.name) ?? []),
  ].join(" ");
}

function labelFor(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";
}
