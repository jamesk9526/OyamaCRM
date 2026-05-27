/** Shared audience and tag manager for email campaigns and printable letter workflows. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import AudienceListManager from "@/app/components/contacts-manager/AudienceListManager";
import DuplicateConstituentMergeTool from "@/app/components/contacts-manager/DuplicateConstituentMergeTool";
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

type ContactFilter = "ALL" | "DONORS" | "CLIENTS" | "NON_DONORS" | "ORGANIZATIONS" | "MISSING_EMAIL";
type ContactsModal = "LISTS" | "DUPLICATES" | "TAGS" | "BULK_TAGS" | null;
type ContactsPageSize = 20 | 50 | 100 | 250 | 500 | "ALL";
type ContactsSortKey = "name" | "email" | "type" | "status" | "giving";
type ContactsSortDirection = "asc" | "desc";
type ListMembershipFilter = "ALL" | "IN_ANY_LIST" | "NOT_IN_ANY_LIST" | "IN_SELECTED_LIST";

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
const PAGE_SIZE_OPTIONS: ContactsPageSize[] = [20, 50, 100, 250, 500, "ALL"];
const CONTACT_SELECTION_STORAGE_KEY = "oyamacrm.contacts-manager.selected-ids:v1";

interface ContactsManagerPageProps {
  fullscreen?: boolean;
}

/** ContactsManagerPage gives staff one place to build reusable audiences for email and print workflows. */
export default function ContactsManagerPage({ fullscreen = false }: ContactsManagerPageProps) {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [tags, setTags] = useState<TagCatalogItem[]>([]);
  const [lists, setLists] = useState<SavedAudienceList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("ALL");
  const [listMembershipFilter, setListMembershipFilter] = useState<ListMembershipFilter>("ALL");
  const [membershipListId, setMembershipListId] = useState("");
  const [listRecipientsById, setListRecipientsById] = useState<Record<string, string[]>>({});
  const [activeTag, setActiveTag] = useState("");
  const [pageSize, setPageSize] = useState<ContactsPageSize>(100);
  const [sortKey, setSortKey] = useState<ContactsSortKey>("name");
  const [sortDirection, setSortDirection] = useState<ContactsSortDirection>("asc");
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
  const allListRecipientEmails = useMemo(() => {
    return new Set(Object.values(listRecipientsById).flat());
  }, [listRecipientsById]);
  const selectedMembershipEmails = useMemo(() => {
    return new Set(membershipListId ? listRecipientsById[membershipListId] ?? [] : []);
  }, [listRecipientsById, membershipListId]);

  const filteredConstituents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return constituents.filter((row) => {
      const rowEmail = row.email?.trim().toLowerCase() ?? "";
      if (filter === "DONORS" && !isDonor(row)) return false;
      if (filter === "CLIENTS" && !isClientContact(row)) return false;
      if (filter === "NON_DONORS" && isDonor(row)) return false;
      if (filter === "ORGANIZATIONS" && !["ORGANIZATION", "FOUNDATION", "SPONSOR"].includes(row.type)) return false;
      if (filter === "MISSING_EMAIL" && row.email) return false;
      if (listMembershipFilter === "IN_ANY_LIST" && (!rowEmail || !allListRecipientEmails.has(rowEmail))) return false;
      if (listMembershipFilter === "NOT_IN_ANY_LIST" && rowEmail && allListRecipientEmails.has(rowEmail)) return false;
      if (listMembershipFilter === "IN_SELECTED_LIST" && (!membershipListId || !rowEmail || !selectedMembershipEmails.has(rowEmail))) return false;
      if (activeTag && !row.tags?.some((entry) => entry.tag.name === activeTag)) return false;
      if (!query) return true;
      return contactHaystack(row).toLowerCase().includes(query);
    });
  }, [activeTag, allListRecipientEmails, constituents, filter, listMembershipFilter, membershipListId, search, selectedMembershipEmails]);

  const selectedRows = useMemo(() => constituents.filter((row) => selectedIds.has(row.id)), [constituents, selectedIds]);
  const selectedEmails = useMemo(
    () => selectedRows.map((row) => row.email?.trim().toLowerCase()).filter(Boolean) as string[],
    [selectedRows],
  );
  const viewEmailCount = useMemo(() => filteredConstituents.filter((row) => row.email?.trim()).length, [filteredConstituents]);
  const sortedConstituents = useMemo(() => {
    return [...filteredConstituents].sort((left, right) => compareConstituents(left, right, sortKey, sortDirection));
  }, [filteredConstituents, sortDirection, sortKey]);
  const visibleConstituents = useMemo(() => {
    return pageSize === "ALL" ? sortedConstituents : sortedConstituents.slice(0, pageSize);
  }, [pageSize, sortedConstituents]);
  const allVisibleSelected = visibleConstituents.length > 0 && visibleConstituents.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = visibleConstituents.some((row) => selectedIds.has(row.id));
  const missingSelectedEmails = selectedRows.length - selectedEmails.length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactRows, tagRows, listRows] = await Promise.all([
        apiFetch<ConstituentRow[]>("/api/constituents?limit=all"),
        apiFetch<TagCatalogItem[]>("/api/constituents/tags/catalog"),
        apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
      ]);
      const listDetails = await Promise.all(
        listRows.map(async (list) => {
          try {
            const detail = await apiFetch<SavedAudienceDetail>(`/api/email-campaigns/lists/${list.id}`);
            return [list.id, detail.recipients.map((row) => row.email.trim().toLowerCase()).filter(Boolean)] as const;
          } catch {
            return [list.id, []] as const;
          }
        }),
      );
      setConstituents(contactRows);
      setTags(tagRows);
      setLists(listRows);
      setListRecipientsById(Object.fromEntries(listDetails));
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
    try {
      const storedIds = JSON.parse(window.localStorage.getItem(CONTACT_SELECTION_STORAGE_KEY) ?? "[]");
      if (Array.isArray(storedIds)) {
        setSelectedIds(new Set(storedIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
      }
    } catch {
      window.localStorage.removeItem(CONTACT_SELECTION_STORAGE_KEY);
    } finally {
      setSelectionHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!selectionHydrated) return;
    if (selectedIds.size === 0) {
      window.localStorage.removeItem(CONTACT_SELECTION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CONTACT_SELECTION_STORAGE_KEY, JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds, selectionHydrated]);

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

  function selectDisplayed() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of visibleConstituents) next.add(row.id);
      return next;
    });
    setBuilderOpen(true);
  }

  function selectFiltered() {
    setSelectedIds(new Set(filteredConstituents.map((row) => row.id)));
    setBuilderOpen(true);
  }

  function toggleDisplayedSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const row of visibleConstituents) next.delete(row.id);
      } else {
        for (const row of visibleConstituents) next.add(row.id);
      }
      return next;
    });
    setBuilderOpen(true);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    window.localStorage.removeItem(CONTACT_SELECTION_STORAGE_KEY);
  }

  function startNewList() {
    setSelectedListId(null);
    setListName("");
    setDescription("");
    setExternalEmails("");
    setMessage(null);
    setError(null);
    setBuilderOpen(true);
  }

  function updateSort(nextKey: ContactsSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "giving" ? "desc" : "asc");
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
    <div className={fullscreen ? "flex h-[calc(100vh-5.5rem)] min-w-0 flex-col space-y-2 overflow-hidden" : "min-w-0 space-y-4"}>
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Outreach", href: "/communications" },
          { label: "Contacts Manager", href: fullscreen ? "/contacts-manager" : undefined },
          ...(fullscreen ? [{ label: "Full Screen" }] : []),
        ]}
        statusLabel={fullscreen ? "Spreadsheet Workspace" : "Working"}
        metadata={`${constituents.length} constituents | ${lists.length} saved segments | ${tags.length} tags | ${selectedIds.size} selected`}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            {fullscreen ? (
              <Link href="/contacts-manager" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Exit Full Screen</Link>
            ) : (
              <>
                <Link href="/communications" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Email Projects</Link>
                <Link href="/oyama-letters/generate" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Letter Generation</Link>
              </>
            )}
          </div>
        }
      />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Audiences">
          <WorkspaceRibbonButton label="List Builder" onClick={() => setBuilderOpen((value) => !value)} variant="primary" active={builderOpen} title="Show or hide the side-by-side audience list builder" />
          <WorkspaceRibbonButton label="List Manager" onClick={() => setActiveModal("LISTS")} title="Manage, preview, merge, duplicate, rename, and delete saved segment lists" />
          <WorkspaceRibbonButton label="New List" onClick={startNewList} title="Create a new reusable audience list" />
          <WorkspaceRibbonButton label="Use View" onClick={listFromCurrentView} title="Draft an audience list from the current filtered view" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Clean Up">
          <WorkspaceRibbonButton label="Find Duplicates" onClick={() => setActiveModal("DUPLICATES")} title="Review possible duplicate constituents by name and approve or decline each merge" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Tags">
          <WorkspaceRibbonButton label="Tag Library" onClick={() => setActiveModal("TAGS")} title="Open tag library and create custom tags" />
          <WorkspaceRibbonButton label="Bulk Tags" onClick={() => setActiveModal("BULK_TAGS")} title="Add or remove tags from selected constituents" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Selection">
          <WorkspaceRibbonButton label={selectionMode ? "Select Tool On" : "Select Tool"} onClick={() => setSelectionMode((value) => !value)} active={selectionMode} title="Show checkbox selection controls in the table" />
          <WorkspaceRibbonButton label={`Select Page (${visibleConstituents.length})`} onClick={selectDisplayed} title="Add every constituent currently shown on this page to the list" />
          <WorkspaceRibbonButton label={`Select View (${filteredConstituents.length})`} onClick={selectFiltered} title="Select every constituent in the current filtered view" />
          <WorkspaceRibbonButton label="Clear" onClick={clearSelection} disabled={selectedIds.size === 0} title="Clear selected constituents" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Open">
          <WorkspaceRibbonButton label={fullscreen ? "Exit Full Screen" : "Full Screen"} href={fullscreen ? "/contacts-manager" : "/contacts-manager/fullscreen"} title="Open the immersive spreadsheet Contacts Manager workspace" />
          <WorkspaceRibbonButton label="Import List CSV" href="/data-tools/import?target=list" title="Import a CSV and create a reusable Contacts Manager audience list" />
          <WorkspaceRibbonButton label="Email Projects" href="/communications" title="Open communications project library" />
          <WorkspaceRibbonButton label="Letter Generation" href="/oyama-letters/generate" title="Open letter generation workspace" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className={fullscreen ? "shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2" : "rounded-xl border border-gray-200 bg-white p-4"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Segment Builder</h2>
            {!fullscreen && <p className="mt-1 text-xs text-gray-500">Start with a common list, refine it with search or tags, then save it once for communications and print workflows.</p>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{constituents.length} constituents</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{selectedIds.size} selected</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{selectedEmails.length} selected emails</span>
          </div>
        </div>
        <div className={fullscreen ? "mt-2 grid gap-2 md:grid-cols-5" : "mt-3 grid gap-3 md:grid-cols-5"}>
          {SEGMENT_RECIPES.map((recipe) => (
            <button key={recipe.id} type="button" onClick={() => applyRecipe(recipe)} className={fullscreen ? "rounded-md border border-gray-200 px-2 py-1.5 text-left hover:border-green-300 hover:bg-green-50" : "rounded-lg border border-gray-200 p-3 text-left hover:border-green-300 hover:bg-green-50"}>
              <span className="text-sm font-semibold text-gray-900">{recipe.name}</span>
              {!fullscreen && <span className="mt-1 block text-xs text-gray-500">{recipe.description}</span>}
            </button>
          ))}
        </div>
      </section>

      <div className={`grid min-w-0 items-start gap-4 ${fullscreen ? "min-h-0 flex-1" : ""} ${builderOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <section className={fullscreen ? "flex min-h-0 min-w-0 flex-col rounded-lg border border-gray-200 bg-white" : "min-w-0 rounded-xl border border-gray-200 bg-white"}>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-2.5">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search constituents, tags, email, employer..." className="min-w-52 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as ContactFilter)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
              <option value="ALL">All</option>
              <option value="DONORS">Donors</option>
              <option value="CLIENTS">Clients</option>
              <option value="NON_DONORS">Non-donors</option>
              <option value="ORGANIZATIONS">Organizations</option>
              <option value="MISSING_EMAIL">Missing email</option>
            </select>
            <select value={listMembershipFilter} onChange={(event) => setListMembershipFilter(event.target.value as ListMembershipFilter)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
              <option value="ALL">Any list status</option>
              <option value="IN_ANY_LIST">In any list</option>
              <option value="NOT_IN_ANY_LIST">Not in lists</option>
              <option value="IN_SELECTED_LIST">Only selected list</option>
            </select>
            <select value={membershipListId} onChange={(event) => { setMembershipListId(event.target.value); if (event.target.value) setListMembershipFilter("IN_SELECTED_LIST"); }} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
              <option value="">Choose list</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
            <select value={activeTag} onChange={(event) => setActiveTag(event.target.value)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
              <option value="">Any tag</option>
              {tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600">
              Show
              <select value={String(pageSize)} onChange={(event) => setPageSize(parsePageSize(event.target.value))} className="border-0 bg-transparent p-0 text-xs font-semibold text-gray-900 outline-none">
                {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={String(option)}>{option === "ALL" ? "All" : option}</option>)}
              </select>
            </label>
          </div>

          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            View: <span className="font-semibold text-gray-900">{filteredConstituents.length}</span> constituents, <span className="font-semibold text-gray-900">{viewEmailCount}</span> with email. Showing <span className="font-semibold text-gray-900">{visibleConstituents.length}</span> sorted by <span className="font-semibold text-gray-900">{sortLabel(sortKey)}</span>.
          </div>

          <div className={fullscreen ? "min-h-0 flex-1 overflow-auto" : "max-h-[calc(100vh-18rem)] overflow-auto"}>
            <table className="min-w-[980px] divide-y divide-gray-200 text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 shadow-sm">
                <tr>
                  <th className={`${selectionMode ? "w-10" : "w-0"} px-2 py-2`}>
                    {selectionMode && (
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleDisplayedSelection} aria-label={allVisibleSelected ? "Remove visible constituents from list" : "Add visible constituents to list"} />
                    )}
                  </th>
                  <SortableHeader label="Constituent" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                  <SortableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                  <SortableHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                  <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                  <th className="px-2 py-2">Tags</th>
                  <SortableHeader label="Giving" sortKey="giving" activeKey={sortKey} direction={sortDirection} onSort={updateSort} align="right" />
                  <th className="px-2 py-2">Actions</th>
                  <th className="w-14 px-2 py-2 text-right">Add</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Loading constituents...</td></tr>
                ) : filteredConstituents.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No constituents match this view.</td></tr>
                ) : visibleConstituents.map((row) => (
                  <tr key={row.id} className={`${selectedIds.has(row.id) ? "bg-green-50/50" : "bg-white"} hover:bg-gray-50`}>
                    <td className="px-2 py-1.5">
                      {selectionMode && <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${contactName(row)}`} />}
                    </td>
                    <td className="px-2 py-1.5">
                      <p className="truncate font-semibold text-gray-900">{contactName(row)}</p>
                      <p className="truncate text-[11px] text-gray-500">{row.employer || row.phone || "No organization"}</p>
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">
                      <span className="block max-w-52 truncate">{row.email || "No email"}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">{labelFor(row.type)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">{labelFor(row.donorStatus)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {(row.tags ?? []).length === 0 ? <span className="text-xs text-gray-400">No tags</span> : row.tags?.map((entry) => (
                          <button key={entry.tag.name} type="button" onClick={() => setActiveTag(entry.tag.name)} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${entry.tag.color}22`, color: entry.tag.color }}>{entry.tag.name}</button>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-700">{formatMoney(row.totalLifetimeGiving)}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => setTagEditor({ constituent: row, tags: row.tags?.map((entry) => entry.tag.name).join(", ") ?? "" })} className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50">Tags</button>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => toggleSelected(row.id)} className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${selectedIds.has(row.id) ? "border-green-300 bg-green-100 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`} title={selectedIds.has(row.id) ? "Remove from segment" : "Add to segment"}>
                        {selectedIds.has(row.id) ? "←" : "→"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectionMode && someVisibleSelected && !allVisibleSelected && (
            <div className="border-t border-gray-100 bg-green-50 px-3 py-2 text-xs text-green-700">
              Some displayed constituents are selected. Use the header checkbox to add the rest of this page.
            </div>
          )}
      </section>
      {builderOpen && (
        <aside className={fullscreen ? "flex max-h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white" : "sticky top-4 flex max-h-[calc(100vh-7rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"}>
          <div className="shrink-0 border-b border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">List Builder</h2>
                <p className="mt-0.5 text-xs text-gray-500">Use row arrows to build this segment.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={startNewList} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">New</button>
                <button type="button" onClick={() => setBuilderOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50" title="Collapse List Builder" aria-label="Collapse List Builder">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </div>
            <select value={selectedListId ?? ""} onChange={(event) => setSelectedListId(event.target.value || null)} className="mt-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm">
              <option value="">New segment</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipientsCount})</option>)}
            </select>
          </div>

          <div className="shrink-0 border-b border-gray-200 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bulk tag this segment</h3>
            <input value={bulkTagNames} onChange={(event) => setBulkTagNames(event.target.value)} placeholder="Donor, Church, Newsletter" className="mt-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void bulkTagAction("ADD")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">Add Tags</button>
              <button type="button" onClick={() => void bulkTagAction("REMOVE")} disabled={saving || selectedIds.size === 0 || splitTags(bulkTagNames).length === 0} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Remove</button>
            </div>
          </div>

          <div className="shrink-0 space-y-2 p-3">
            <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Spring Newsletter Audience" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Purpose, criteria, or AI notes" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
            <textarea value={externalEmails} onChange={(event) => setExternalEmails(event.target.value)} rows={2} placeholder="External emails, one per line" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-gray-50 p-1.5"><span className="block font-semibold text-gray-900">{selectedRows.length}</span><span className="text-gray-500">selected</span></div>
              <div className="rounded-lg bg-gray-50 p-1.5"><span className="block font-semibold text-gray-900">{selectedEmails.length}</span><span className="text-gray-500">emails</span></div>
              <div className="rounded-lg bg-gray-50 p-1.5"><span className="block font-semibold text-gray-900">{missingSelectedEmails}</span><span className="text-gray-500">no email</span></div>
            </div>
            <button type="button" onClick={() => void saveList()} disabled={saving || !listName.trim()} className="w-full rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : selectedList ? "Update Segment" : "Save Segment"}</button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected People</h3>
              <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0} className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50">Clear</button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.55)_transparent]">
              {selectedRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">No one selected yet. Use the arrows in the contact table.</p>
              ) : selectedRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900">{contactName(row)}</p>
                    <p className="truncate text-xs text-gray-500">{row.email || "No email"}</p>
                  </div>
                  <button type="button" onClick={() => toggleSelected(row.id)} className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
      </div>

      {activeModal === "LISTS" && (
        <ContactsManagerModal
          title="Audience List Manager"
          onClose={() => setActiveModal(null)}
          maxWidthClass="max-w-7xl"
          headerAction={<Link href="/contacts-manager/lists" target="_blank" className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Open Full Screen</Link>}
        >
          <AudienceListManager
            lists={lists}
            listRecipientsById={listRecipientsById}
            constituents={constituents}
            onReload={load}
            onMessage={setMessage}
            onError={setError}
            onLoadList={(listId) => {
              setSelectedListId(listId);
              setBuilderOpen(true);
              setActiveModal(null);
            }}
          />
        </ContactsManagerModal>
      )}

      {activeModal === "DUPLICATES" && (
        <ContactsManagerModal title="Duplicate Constituent Merge Review" onClose={() => setActiveModal(null)} maxWidthClass="max-w-7xl">
          <DuplicateConstituentMergeTool
            constituents={constituents}
            onReload={load}
            onMessage={setMessage}
            onError={setError}
          />
        </ContactsManagerModal>
      )}

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
  headerAction,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
  headerAction?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className={`max-h-[90vh] w-full overflow-hidden rounded-xl bg-white shadow-xl ${maxWidthClass}`}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
        <div className="max-h-[calc(90vh-52px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: ContactsSortKey;
  activeKey: ContactsSortKey;
  direction: ContactsSortDirection;
  onSort: (key: ContactsSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === activeKey;
  return (
    <th className={`px-2 py-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""} rounded text-[11px] font-semibold uppercase tracking-wide hover:text-gray-900`}
      >
        {label}
        <span className={active ? "text-green-700" : "text-gray-300"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
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

function isClientContact(row: ConstituentRow): boolean {
  return row.type === "CLIENT" || row.tags?.some((entry) => entry.tag.name.toLowerCase() === "client") === true;
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

function parsePageSize(value: string): ContactsPageSize {
  if (value === "ALL") return "ALL";
  const numeric = Number(value);
  return PAGE_SIZE_OPTIONS.includes(numeric as ContactsPageSize) ? (numeric as ContactsPageSize) : 100;
}

function sortLabel(key: ContactsSortKey): string {
  if (key === "name") return "constituent";
  if (key === "status") return "donor status";
  if (key === "giving") return "lifetime giving";
  return key;
}

function compareConstituents(left: ConstituentRow, right: ConstituentRow, key: ContactsSortKey, direction: ContactsSortDirection): number {
  const directionValue = direction === "asc" ? 1 : -1;
  if (key === "giving") {
    return (Number(left.totalLifetimeGiving ?? 0) - Number(right.totalLifetimeGiving ?? 0)) * directionValue;
  }

  const leftValue = getSortValue(left, key);
  const rightValue = getSortValue(right, key);
  return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" }) * directionValue;
}

function getSortValue(row: ConstituentRow, key: Exclude<ContactsSortKey, "giving">): string {
  if (key === "name") return contactName(row);
  if (key === "email") return row.email ?? "";
  if (key === "type") return row.type;
  return row.donorStatus;
}
