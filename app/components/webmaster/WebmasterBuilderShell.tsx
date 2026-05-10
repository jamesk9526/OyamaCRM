"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import FeatureDevelopmentDialog from "@/app/components/webmaster/FeatureDevelopmentDialog";
import {
  createDefaultPageSections,
  createSectionFromManifest,
  getSectionManifest,
  listSectionManifests,
} from "@/app/modules/webmaster/section-registry";
import type { BlockInstance, SectionInstance } from "@/app/modules/webmaster/schema";

interface WebmasterSite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

interface WebmasterPage {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  status: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  contentJson: Record<string, unknown> | null;
  updatedAt: string;
}

interface BuilderDocument {
  version: number;
  sections: SectionInstance[];
}

interface SaveState {
  status: "idle" | "dirty" | "saving" | "saved" | "error";
  detail?: string;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseBuilderDocument(content: Record<string, unknown> | null): BuilderDocument {
  if (!content) {
    return { version: 1, sections: createDefaultPageSections() };
  }

  const maybeSections = content.sections;
  if (!Array.isArray(maybeSections)) {
    return { version: 1, sections: createDefaultPageSections() };
  }

  const sections = maybeSections
    .map((entry) => entry as SectionInstance)
    .filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.type === "string");

  if (sections.length === 0) {
    return { version: 1, sections: createDefaultPageSections() };
  }

  return { version: Number(content.version ?? 1), sections };
}

function defaultPageSettings(page: WebmasterPage) {
  return {
    title: page.title,
    slug: page.slug,
    path: page.path,
    status: page.status,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
  };
}

/** Visual builder shell for section-first page composition and save/load flow. */
export default function WebmasterBuilderShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [pages, setPages] = useState<WebmasterPage[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageSettings, setPageSettings] = useState<ReturnType<typeof defaultPageSettings> | null>(null);
  const [document, setDocument] = useState<BuilderDocument | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BuilderDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [featureNotice, setFeatureNotice] = useState<{ title: string; detail: string } | null>(null);

  const manifests = useMemo(() => listSectionManifests(), []);

  const loadSites = useCallback(async () => {
    const data = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
    const nextSites = Array.isArray(data.items) ? data.items : [];
    setSites(nextSites);
    return nextSites;
  }, []);

  const loadPages = useCallback(async (siteId: string) => {
    if (!siteId) {
      setPages([]);
      return [] as WebmasterPage[];
    }

    const data = await apiFetch<{ items: WebmasterPage[] }>(`/api/webmaster/sites/${siteId}/pages`);
    const nextPages = Array.isArray(data.items) ? data.items : [];
    setPages(nextPages);
    return nextPages;
  }, []);

  const boot = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const nextSites = await loadSites();
      const querySiteId = searchParams.get("siteId") ?? "";
      const initialSiteId = querySiteId && nextSites.some((site) => site.id === querySiteId)
        ? querySiteId
        : (nextSites[0]?.id ?? "");

      setSelectedSiteId(initialSiteId);

      const nextPages = await loadPages(initialSiteId);
      const queryPageId = searchParams.get("pageId") ?? "";
      const initialPage = queryPageId && nextPages.some((page) => page.id === queryPageId)
        ? nextPages.find((page) => page.id === queryPageId) ?? null
        : (nextPages[0] ?? null);

      if (!initialPage) {
        setSelectedPageId("");
        setPageSettings(null);
        setDocument(null);
        setHistory([]);
        setHistoryIndex(-1);
        return;
      }

      setSelectedPageId(initialPage.id);
      setPageSettings(defaultPageSettings(initialPage));
      const parsed = parseBuilderDocument(initialPage.contentJson);
      setDocument(parsed);
      setHistory([parsed]);
      setHistoryIndex(0);
      setSaveState({ status: "idle" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load builder workspace.");
    } finally {
      setBusy(false);
    }
  }, [loadPages, loadSites, searchParams]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const selectedSection = useMemo(
    () => document?.sections.find((section) => section.id === selectedSectionId) ?? null,
    [document, selectedSectionId],
  );

  const selectedBlock = useMemo(() => {
    if (!selectedSection || !selectedBlockId) return null;
    return selectedSection.blocks.find((block) => block.id === selectedBlockId) ?? null;
  }, [selectedSection, selectedBlockId]);

  const issueCount = useMemo(() => {
    if (!pageSettings || !document) return 0;

    let issues = 0;
    if (!pageSettings.seoTitle.trim()) issues += 1;
    if (!pageSettings.seoDescription.trim()) issues += 1;
    if (document.sections.length === 0) issues += 2;
    if (document.sections.some((section) => section.blocks.length === 0)) issues += 1;
    return issues;
  }, [document, pageSettings]);

  const healthScore = useMemo(() => Math.max(0, 100 - issueCount * 14), [issueCount]);

  function commitDocument(nextDocument: BuilderDocument) {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(nextDocument);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setDocument(nextDocument);
    setSaveState({ status: "dirty", detail: "Unsaved changes" });
  }

  async function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    const nextPages = await loadPages(siteId);

    const firstPage = nextPages[0] ?? null;
    if (!firstPage) {
      setSelectedPageId("");
      setPageSettings(null);
      setDocument(null);
      setSaveState({ status: "idle" });
      return;
    }

    setSelectedPageId(firstPage.id);
    setPageSettings(defaultPageSettings(firstPage));
    const parsed = parseBuilderDocument(firstPage.contentJson);
    setDocument(parsed);
    setHistory([parsed]);
    setHistoryIndex(0);
    setSaveState({ status: "idle" });
    router.replace(`/webmaster/builder?siteId=${siteId}&pageId=${firstPage.id}`);
  }

  function handlePageChange(pageId: string) {
    const nextPage = pages.find((page) => page.id === pageId) ?? null;
    if (!nextPage) return;

    setSelectedPageId(nextPage.id);
    setPageSettings(defaultPageSettings(nextPage));
    const parsed = parseBuilderDocument(nextPage.contentJson);
    setDocument(parsed);
    setSelectedSectionId(null);
    setSelectedBlockId(null);
    setHistory([parsed]);
    setHistoryIndex(0);
    setSaveState({ status: "idle" });
    router.replace(`/webmaster/builder?siteId=${nextPage.siteId}&pageId=${nextPage.id}`);
  }

  function addSection(type: string) {
    if (!document) return;

    const section = createSectionFromManifest(type);
    const nextDocument: BuilderDocument = {
      ...document,
      sections: [...document.sections, section],
    };

    commitDocument(nextDocument);
    setSelectedSectionId(section.id);
    setSelectedBlockId(null);
  }

  function removeSection(sectionId: string) {
    if (!document) return;

    const nextDocument: BuilderDocument = {
      ...document,
      sections: document.sections.filter((section) => section.id !== sectionId),
    };

    commitDocument(nextDocument);
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
      setSelectedBlockId(null);
    }
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    if (!document) return;

    const index = document.sections.findIndex((entry) => entry.id === sectionId);
    if (index < 0) return;

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= document.sections.length) return;

    const nextSections = [...document.sections];
    const [moved] = nextSections.splice(index, 1);
    nextSections.splice(nextIndex, 0, moved);

    commitDocument({ ...document, sections: nextSections });
  }

  function duplicateSection(sectionId: string) {
    if (!document) return;

    const index = document.sections.findIndex((entry) => entry.id === sectionId);
    if (index < 0) return;

    const source = document.sections[index];
    const clone: SectionInstance = {
      ...source,
      id: createId(),
      blocks: source.blocks.map((block) => ({ ...block, id: createId() })),
    };

    const nextSections = [...document.sections];
    nextSections.splice(index + 1, 0, clone);
    commitDocument({ ...document, sections: nextSections });
    setSelectedSectionId(clone.id);
    setSelectedBlockId(null);
  }

  function updateSection(sectionId: string, updater: (current: SectionInstance) => SectionInstance) {
    if (!document) return;

    const nextSections = document.sections.map((section) => (section.id === sectionId ? updater(section) : section));
    commitDocument({ ...document, sections: nextSections });
  }

  function updateBlock(sectionId: string, blockId: string, updater: (current: BlockInstance) => BlockInstance) {
    updateSection(sectionId, (section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    }));
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setDocument(history[nextIndex]);
    setSaveState({ status: "dirty", detail: "Reverted changes" });
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setDocument(history[nextIndex]);
    setSaveState({ status: "dirty", detail: "Reapplied changes" });
  }

  async function savePage() {
    if (!selectedPage || !pageSettings || !document) return;

    setSaveState({ status: "saving", detail: "Saving page..." });

    try {
      const payload = {
        title: pageSettings.title,
        slug: toSlug(pageSettings.slug || pageSettings.title),
        path: pageSettings.path,
        status: pageSettings.status,
        seoTitle: pageSettings.seoTitle,
        seoDescription: pageSettings.seoDescription,
        contentJson: document,
      };

      const data = await apiFetch<{ item: WebmasterPage }>(`/api/webmaster/pages/${selectedPage.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const updated = data.item;
      const nextPages = pages.map((page) => (page.id === updated.id ? updated : page));
      setPages(nextPages);
      setPageSettings(defaultPageSettings(updated));
      setDocument(parseBuilderDocument(updated.contentJson));
      setSaveState({ status: "saved", detail: `Saved ${new Date().toLocaleTimeString()}` });
    } catch (requestError) {
      setSaveState({
        status: "error",
        detail: requestError instanceof Error ? requestError.message : "Failed to save page.",
      });
    }
  }

  if (busy) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <FeatureDevelopmentDialog
        open={Boolean(featureNotice)}
        title={featureNotice?.title ?? "Feature in progress"}
        detail={featureNotice?.detail ?? "This area is still being developed."}
        onClose={() => setFeatureNotice(null)}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
        <select
          value={selectedSiteId}
          onChange={(e) => void handleSiteChange(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>

        <select
          value={selectedPageId}
          onChange={(e) => handlePageChange(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>{page.title}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setDevice(entry)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${device === entry ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300"}`}
            >
              {entry}
            </button>
          ))}

          <button type="button" onClick={undo} disabled={historyIndex <= 0} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40">Undo</button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40">Redo</button>

          <button
            type="button"
            onClick={() => setFeatureNotice({
              title: "Preview Mode",
              detail: "Full browser-accurate preview and staged preview URLs are still being built. Continue using the canvas preview for layout checks.",
            })}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700"
          >
            Preview
          </button>

          <button
            type="button"
            onClick={() => setFeatureNotice({
              title: "Export",
              detail: "Static ZIP export and project JSON export are next milestones and are not fully wired yet.",
            })}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700"
          >
            Export
          </button>

          <button
            type="button"
            onClick={() => setFeatureNotice({
              title: "Publish",
              detail: "Publishing targets and rollback history are still under active development.",
            })}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700"
          >
            Publish
          </button>

          <button
            type="button"
            onClick={() => void savePage()}
            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Save
          </button>
        </div>
      </div>

      {!selectedPage || !pageSettings || !document ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Select a website and page to begin editing in the builder shell.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Section</h2>
            {manifests.map((manifest) => (
              <button
                key={manifest.type}
                type="button"
                onClick={() => addSection(manifest.type)}
                className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-800">{manifest.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{manifest.category}</p>
              </button>
            ))}
          </aside>

          <section className="col-span-12 lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{pageSettings.title}</h2>
                <p className="text-xs text-slate-500">{selectedSite?.name} • {device} preview</p>
              </div>
              <span className="text-xs text-slate-500">{document.sections.length} sections</span>
            </div>

            <div className={`mx-auto rounded-xl border border-slate-200 bg-slate-50 p-3 ${device === "desktop" ? "max-w-full" : device === "tablet" ? "max-w-2xl" : "max-w-md"}`}>
              <div className="space-y-3">
                {document.sections.map((section) => {
                  const manifest = getSectionManifest(section.type);
                  const isSelected = selectedSectionId === section.id;

                  return (
                    <article
                      key={section.id}
                      className={`rounded-lg border p-3 ${isSelected ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200 bg-white"}`}
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setSelectedBlockId(null);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{manifest?.name ?? section.type}</p>
                          <p className="text-sm font-semibold text-slate-900">{section.label || manifest?.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(section.id, "up"); }} className="px-2 py-1 text-xs rounded border border-slate-300">↑</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(section.id, "down"); }} className="px-2 py-1 text-xs rounded border border-slate-300">↓</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }} className="px-2 py-1 text-xs rounded border border-slate-300">Duplicate</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="px-2 py-1 text-xs rounded border border-rose-300 text-rose-700">Delete</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {section.blocks.map((block) => {
                          const contentText = typeof block.content.text === "string"
                            ? block.content.text
                            : typeof block.content.question === "string"
                              ? `${block.content.question}`
                              : block.type;

                          const isBlockSelected = selectedBlockId === block.id;

                          return (
                            <button
                              key={block.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSectionId(section.id);
                                setSelectedBlockId(block.id);
                              }}
                              className={`w-full text-left rounded-md px-2 py-1 text-sm border ${isBlockSelected ? "border-emerald-400 bg-white" : "border-slate-200 bg-slate-50"}`}
                            >
                              {contentText}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-4">
            {selectedBlock && selectedSection ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Block Settings</h3>
                <p className="text-xs text-slate-500">Type: {selectedBlock.type}</p>

                <label className="block text-xs text-slate-600">Text Content</label>
                <textarea
                  value={String(selectedBlock.content.text ?? selectedBlock.content.question ?? "")}
                  onChange={(e) => {
                    updateBlock(selectedSection.id, selectedBlock.id, (current) => ({
                      ...current,
                      content: {
                        ...current.content,
                        text: e.target.value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={4}
                />

                <label className="block text-xs text-slate-600">Link</label>
                <input
                  value={String(selectedBlock.content.href ?? "")}
                  onChange={(e) => {
                    updateBlock(selectedSection.id, selectedBlock.id, (current) => ({
                      ...current,
                      content: {
                        ...current.content,
                        href: e.target.value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ) : selectedSection ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Section Settings</h3>
                <label className="block text-xs text-slate-600">Section Label</label>
                <input
                  value={selectedSection.label ?? ""}
                  onChange={(e) => {
                    updateSection(selectedSection.id, (current) => ({ ...current, label: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Variant</label>
                <input
                  value={selectedSection.variant}
                  onChange={(e) => {
                    updateSection(selectedSection.id, (current) => ({ ...current, variant: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Background</label>
                <input
                  value={String(selectedSection.settings.background ?? "")}
                  onChange={(e) => {
                    updateSection(selectedSection.id, (current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        background: e.target.value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Page Settings</h3>

                <label className="block text-xs text-slate-600">Title</label>
                <input
                  value={pageSettings.title}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, title: e.target.value } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Slug</label>
                <input
                  value={pageSettings.slug}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, slug: e.target.value } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Path</label>
                <input
                  value={pageSettings.path}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, path: e.target.value } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Status</label>
                <select
                  value={pageSettings.status}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, status: e.target.value as WebmasterPage["status"] } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="REVIEW_READY">REVIEW_READY</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>

                <label className="block text-xs text-slate-600">SEO Title</label>
                <input
                  value={pageSettings.seoTitle}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, seoTitle: e.target.value } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-xs text-slate-600">Meta Description</label>
                <textarea
                  rows={4}
                  value={pageSettings.seoDescription}
                  onChange={(e) => {
                    setPageSettings((current) => current ? { ...current, seoDescription: e.target.value } : current);
                    setSaveState({ status: "dirty", detail: "Unsaved changes" });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span>Save: {saveState.detail ?? saveState.status}</span>
        <span>Breakpoint: {device}</span>
        <span>Path: {pageSettings?.path ?? "-"}</span>
        <span>Health Score: {healthScore}</span>
        <span>Issues: {issueCount}</span>
        <span>Preview URL: {selectedSite?.domain ? `https://${selectedSite.domain}${pageSettings?.path ?? ""}` : "Domain not configured"}</span>
      </div>
    </div>
  );
}
