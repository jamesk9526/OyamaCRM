/** Full-tab visual website editor workspace for OyamaWebMaster. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { createSectionFromManifest } from "@/app/modules/webmaster/section-registry";
import type { BlockInstance, SectionInstance } from "@/app/modules/webmaster/schema";
import WebmasterEditorCanvas from "./WebmasterEditorCanvas";
import WebmasterEditorInspector from "./WebmasterEditorInspector";
import WebmasterEditorLeftRail from "./WebmasterEditorLeftRail";
import WebmasterEditorTopBar from "./WebmasterEditorTopBar";
import {
  calculateHealthScore,
  createId,
  defaultPageSettings,
  parseBuilderDocument,
  toSlug,
} from "./editor-utils";
import type {
  DeviceMode,
  LeftRailPanel,
  PageSettingsState,
  PublishReadinessData,
  SaveState,
  WebmasterDocument,
  WebmasterPage,
  WebmasterSite,
} from "./types";

interface HistorySnapshot {
  document: WebmasterDocument;
  pageSettings: PageSettingsState;
}

/** Visual editor route with live page canvas, inspector, and draft preview workflow. */
export default function WebmasterEditorWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [pages, setPages] = useState<WebmasterPage[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageSettings, setPageSettings] = useState<PageSettingsState | null>(null);
  const [document, setDocument] = useState<WebmasterDocument | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [leftPanel, setLeftPanel] = useState<LeftRailPanel>("pages");
  const [previewInEditor, setPreviewInEditor] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<PublishReadinessData | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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

  const health = useMemo(() => calculateHealthScore({ document, pageSettings }), [document, pageSettings]);

  const channel = useMemo(
    () => (typeof window !== "undefined" ? new BroadcastChannel("webmaster-preview") : null),
    [],
  );

  const refreshReadiness = useCallback(async (siteId: string) => {
    if (!siteId) {
      setReadiness(null);
      return;
    }

    try {
      const response = await apiFetch<{ data: PublishReadinessData }>(`/api/webmaster/sites/${siteId}/publish-readiness`);
      setReadiness(response.data);
    } catch {
      setReadiness(null);
    }
  }, []);

  const loadSites = useCallback(async () => {
    const response = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
    return Array.isArray(response.items) ? response.items : [];
  }, []);

  const loadPages = useCallback(async (siteId: string) => {
    if (!siteId) return [] as WebmasterPage[];
    const response = await apiFetch<{ items: WebmasterPage[] }>(`/api/webmaster/sites/${siteId}/pages`);
    return Array.isArray(response.items) ? response.items : [];
  }, []);

  function commit(nextDocument: WebmasterDocument, nextPageSettings: PageSettingsState) {
    const snapshots = history.slice(0, historyIndex + 1);
    snapshots.push({ document: nextDocument, pageSettings: nextPageSettings });

    setHistory(snapshots);
    setHistoryIndex(snapshots.length - 1);
    setDocument(nextDocument);
    setPageSettings(nextPageSettings);
    setSaveState({ status: "dirty", detail: "Unsaved changes" });
  }

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextSites = await loadSites();
      setSites(nextSites);

      const querySiteId = searchParams.get("siteId") ?? "";
      const initialSiteId = querySiteId && nextSites.some((site) => site.id === querySiteId)
        ? querySiteId
        : (nextSites[0]?.id ?? "");
      setSelectedSiteId(initialSiteId);

      const nextPages = await loadPages(initialSiteId);
      setPages(nextPages);

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
        await refreshReadiness(initialSiteId);
        return;
      }

      const parsed = parseBuilderDocument(initialPage.contentJson);
      const settings = defaultPageSettings(initialPage);

      setSelectedPageId(initialPage.id);
      setPageSettings(settings);
      setDocument(parsed);
      setHistory([{ document: parsed, pageSettings: settings }]);
      setHistoryIndex(0);
      setSaveState({ status: "idle" });
      await refreshReadiness(initialSiteId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load editor workspace.");
    } finally {
      setLoading(false);
    }
  }, [loadPages, loadSites, refreshReadiness, searchParams]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    return () => {
      channel?.close();
    };
  }, [channel]);

  async function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setSelectedSectionId(null);
    setSelectedBlockId(null);

    const nextPages = await loadPages(siteId);
    setPages(nextPages);

    const firstPage = nextPages[0] ?? null;
    if (!firstPage) {
      setSelectedPageId("");
      setPageSettings(null);
      setDocument(null);
      setHistory([]);
      setHistoryIndex(-1);
      setSaveState({ status: "idle" });
      await refreshReadiness(siteId);
      router.replace(`/webmaster/editor?siteId=${siteId}`);
      return;
    }

    const parsed = parseBuilderDocument(firstPage.contentJson);
    const settings = defaultPageSettings(firstPage);
    setSelectedPageId(firstPage.id);
    setPageSettings(settings);
    setDocument(parsed);
    setHistory([{ document: parsed, pageSettings: settings }]);
    setHistoryIndex(0);
    setSaveState({ status: "idle" });
    await refreshReadiness(siteId);

    router.replace(`/webmaster/editor?siteId=${siteId}&pageId=${firstPage.id}`);
  }

  function handlePageChange(pageId: string) {
    const nextPage = pages.find((page) => page.id === pageId);
    if (!nextPage) return;

    const parsed = parseBuilderDocument(nextPage.contentJson);
    const settings = defaultPageSettings(nextPage);

    setSelectedPageId(nextPage.id);
    setPageSettings(settings);
    setDocument(parsed);
    setSelectedSectionId(null);
    setSelectedBlockId(null);
    setHistory([{ document: parsed, pageSettings: settings }]);
    setHistoryIndex(0);
    setSaveState({ status: "idle" });

    router.replace(`/webmaster/editor?siteId=${nextPage.siteId}&pageId=${nextPage.id}`);
  }

  function updateSection(sectionId: string, updater: (section: SectionInstance) => SectionInstance) {
    if (!document || !pageSettings) return;
    const nextDocument: WebmasterDocument = {
      ...document,
      sections: document.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    };
    commit(nextDocument, pageSettings);
  }

  function updateBlock(sectionId: string, blockId: string, updater: (block: BlockInstance) => BlockInstance) {
    updateSection(sectionId, (section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    }));
  }

  function addSection(type: string, index?: number) {
    if (!document || !pageSettings) return;

    const section = createSectionFromManifest(type);
    const insertionIndex = typeof index === "number"
      ? Math.max(0, Math.min(index, document.sections.length))
      : document.sections.length;

    const nextSections = [...document.sections];
    nextSections.splice(insertionIndex, 0, section);

    commit({ ...document, sections: nextSections }, pageSettings);
    setSelectedSectionId(section.id);
    setSelectedBlockId(null);
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    if (!document || !pageSettings) return;

    const index = document.sections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= document.sections.length) return;

    const nextSections = [...document.sections];
    const [moved] = nextSections.splice(index, 1);
    nextSections.splice(nextIndex, 0, moved);

    commit({ ...document, sections: nextSections }, pageSettings);
  }

  function duplicateSection(sectionId: string) {
    if (!document || !pageSettings) return;

    const index = document.sections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;

    const source = document.sections[index];
    const clone: SectionInstance = {
      ...source,
      id: createId(),
      blocks: source.blocks.map((block) => ({ ...block, id: createId() })),
    };

    const nextSections = [...document.sections];
    nextSections.splice(index + 1, 0, clone);

    commit({ ...document, sections: nextSections }, pageSettings);
    setSelectedSectionId(clone.id);
    setSelectedBlockId(null);
  }

  function deleteSection(sectionId: string) {
    if (!document || !pageSettings) return;

    const nextSections = document.sections.filter((section) => section.id !== sectionId);
    commit({ ...document, sections: nextSections }, pageSettings);

    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
      setSelectedBlockId(null);
    }
  }

  function updatePageSettingsPatch(patch: Partial<PageSettingsState>) {
    if (!document || !pageSettings) return;
    const nextSettings = { ...pageSettings, ...patch };
    commit(document, nextSettings);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    setDocument(snapshot.document);
    setPageSettings(snapshot.pageSettings);
    setSaveState({ status: "dirty", detail: "Reverted changes" });
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    setDocument(snapshot.document);
    setPageSettings(snapshot.pageSettings);
    setSaveState({ status: "dirty", detail: "Reapplied changes" });
  }

  async function saveDraft() {
    if (!selectedPage || !pageSettings || !document) return;

    setSaveState({ status: "saving", detail: "Saving draft..." });
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

      const response = await apiFetch<{ item: WebmasterPage }>(`/api/webmaster/pages/${selectedPage.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const updated = response.item;
      const nextPages = pages.map((page) => (page.id === updated.id ? updated : page));
      setPages(nextPages);
      setSaveState({ status: "saved", detail: `Saved ${new Date().toLocaleTimeString()}` });
      await refreshReadiness(selectedSiteId);

      channel?.postMessage({
        type: "webmaster-draft-saved",
        siteId: selectedSiteId,
        pageId: selectedPage.id,
        at: Date.now(),
      });
    } catch (requestError) {
      setSaveState({
        status: "error",
        detail: requestError instanceof Error ? requestError.message : "Failed to save draft.",
      });
    }
  }

  function openDraftPreview() {
    if (!selectedSiteId || !selectedPageId) return;
    window.open(`/webmaster/preview/${selectedSiteId}/${selectedPageId}?draft=1`, "_blank", "noopener,noreferrer");
  }

  function openPublishSetup() {
    if (!selectedSiteId) {
      router.push("/webmaster/publishing");
      return;
    }

    router.push(`/webmaster/publishing?siteId=${selectedSiteId}`);
  }

  if (loading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  if (!selectedSite || !selectedPage || !pageSettings || !document) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
        Select a site and page to start visual editing.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!previewInEditor ? (
        <WebmasterEditorTopBar
          sites={sites}
          pages={pages}
          selectedSiteId={selectedSiteId}
          selectedPageId={selectedPageId}
          saveState={saveState}
          device={device}
          previewInEditor={previewInEditor}
          healthScore={health.score}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          readiness={readiness}
          onSiteChange={(siteId) => void handleSiteChange(siteId)}
          onPageChange={handlePageChange}
          onSave={() => void saveDraft()}
          onPreviewDraft={openDraftPreview}
          onOpenPublishSetup={openPublishSetup}
          onDeviceChange={setDevice}
          onUndo={undo}
          onRedo={redo}
          onToggleInEditorPreview={() => setPreviewInEditor((current) => !current)}
        />
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-sm font-semibold text-slate-800">In-editor Preview • {selectedPage.title}</p>
          <button
            type="button"
            onClick={() => setPreviewInEditor(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Return To Edit
          </button>
        </div>
      )}

      <div className={`${previewInEditor ? "" : "grid grid-cols-12"} gap-3`}>
        {!previewInEditor ? (
          <div className="col-span-12 lg:col-span-2">
            <WebmasterEditorLeftRail
              activePanel={leftPanel}
              pages={pages}
              selectedPageId={selectedPageId}
              document={document}
              selectedSectionId={selectedSectionId}
              selectedBlockId={selectedBlockId}
              onPanelChange={setLeftPanel}
              onPageSelect={handlePageChange}
              onAddSection={(type) => addSection(type)}
              onSelectLayer={(sectionId, blockId) => {
                setSelectedSectionId(sectionId);
                setSelectedBlockId(blockId ?? null);
              }}
            />
          </div>
        ) : null}

        <div className={`${previewInEditor ? "" : "col-span-12 lg:col-span-8"}`}>
          <WebmasterEditorCanvas
            siteName={selectedSite.name}
            pageTitle={selectedPage.title}
            document={document}
            device={device}
            previewInEditor={previewInEditor}
            selectedSectionId={selectedSectionId}
            selectedBlockId={selectedBlockId}
            onSelectSection={(sectionId) => {
              setSelectedSectionId(sectionId);
              setSelectedBlockId(null);
            }}
            onSelectBlock={(sectionId, blockId) => {
              setSelectedSectionId(sectionId);
              setSelectedBlockId(blockId);
            }}
            onUpdateBlockContent={(sectionId, blockId, patch) => {
              updateBlock(sectionId, blockId, (current) => ({
                ...current,
                content: {
                  ...current.content,
                  ...patch,
                },
              }));
            }}
            onInsertSectionAt={(index) => addSection("text", index)}
            onMoveSection={moveSection}
            onDuplicateSection={duplicateSection}
            onDeleteSection={deleteSection}
          />
        </div>

        {!previewInEditor ? (
          <div className="col-span-12 lg:col-span-2">
            <WebmasterEditorInspector
              pageSettings={pageSettings}
              selectedSection={selectedSection}
              selectedBlock={selectedBlock}
              onUpdatePageSettings={updatePageSettingsPatch}
              onUpdateSection={updateSection}
              onUpdateBlock={updateBlock}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
