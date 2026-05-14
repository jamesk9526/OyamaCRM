"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

interface BuilderBlockTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  content: Record<string, unknown>;
}

interface BlockLocation {
  sectionId: string;
  sectionIndex: number;
  blockIndex: number;
}

const BUILDER_BLOCK_TEMPLATES: BuilderBlockTemplate[] = [
  {
    id: "paragraph",
    type: "text",
    name: "Paragraph",
    description: "Body copy and supporting content.",
    content: { text: "Add your copy here.", level: "p" },
  },
  {
    id: "heading",
    type: "text",
    name: "Heading",
    description: "A clear section headline.",
    content: { text: "Section heading", level: "h2" },
  },
  {
    id: "button",
    type: "button",
    name: "Button",
    description: "Primary call-to-action button.",
    content: { text: "Learn more", href: "#" },
  },
  {
    id: "image",
    type: "image",
    name: "Image",
    description: "Visual content with alt text.",
    content: { src: "", alt: "Website image" },
  },
  {
    id: "faq-item",
    type: "faq-item",
    name: "FAQ Item",
    description: "Question and answer item.",
    content: { question: "Frequently asked question", answer: "Helpful answer for this question." },
  },
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBlockFromTemplate(templateId: string): BlockInstance {
  const template = BUILDER_BLOCK_TEMPLATES.find((entry) => entry.id === templateId) ?? BUILDER_BLOCK_TEMPLATES[0];
  return {
    id: createId(),
    type: template.type,
    content: { ...template.content },
  };
}

function getBlockDisplayText(block: BlockInstance): string {
  if (typeof block.content.text === "string" && block.content.text.trim()) {
    return block.content.text;
  }

  if (typeof block.content.question === "string" && block.content.question.trim()) {
    return block.content.question;
  }

  return block.type;
}

function findBlockLocation(document: BuilderDocument, blockId: string): BlockLocation | null {
  for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex += 1) {
    const section = document.sections[sectionIndex];
    const blockIndex = section.blocks.findIndex((block) => block.id === blockId);
    if (blockIndex >= 0) {
      return {
        sectionId: section.id,
        sectionIndex,
        blockIndex,
      };
    }
  }

  return null;
}

function resolveDropTarget(document: BuilderDocument, overId: string): BlockLocation | null {
  if (overId.startsWith("section:")) {
    const targetSectionId = overId.slice("section:".length);
    const sectionIndex = document.sections.findIndex((section) => section.id === targetSectionId);
    if (sectionIndex < 0) return null;

    return {
      sectionId: targetSectionId,
      sectionIndex,
      blockIndex: document.sections[sectionIndex].blocks.length,
    };
  }

  if (overId.startsWith("block:")) {
    const blockId = overId.slice("block:".length);
    return findBlockLocation(document, blockId);
  }

  return null;
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
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

  const manifests = useMemo(() => listSectionManifests(), []);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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

  async function createStarterPage() {
    if (!selectedSiteId) return;

    try {
      const payload = {
        title: "Home",
        slug: "home",
        path: "/",
        status: "DRAFT" as const,
        seoTitle: "Home",
        seoDescription: "Starter page created from the visual builder.",
        contentJson: {
          version: 1,
          sections: createDefaultPageSections(),
        },
      };

      const data = await apiFetch<{ item: WebmasterPage }>(`/api/webmaster/sites/${selectedSiteId}/pages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdPage = data.item;
      const nextPages = await loadPages(selectedSiteId);
      const selected = nextPages.find((page) => page.id === createdPage.id) ?? createdPage;

      setSelectedPageId(selected.id);
      setPageSettings(defaultPageSettings(selected));
      const parsed = parseBuilderDocument(selected.contentJson);
      setDocument(parsed);
      setHistory([parsed]);
      setHistoryIndex(0);
      setSaveState({ status: "idle" });
      router.replace(`/webmaster/builder?siteId=${selectedSiteId}&pageId=${selected.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create a starter page.");
    }
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

  function addBlockToSection(sectionId: string, templateId: string, insertionIndex?: number) {
    if (!document) return;

    const section = document.sections.find((entry) => entry.id === sectionId);
    if (!section) return;

    const createdBlock = createBlockFromTemplate(templateId);
    const insertAt = Math.max(0, Math.min(insertionIndex ?? section.blocks.length, section.blocks.length));

    const nextSections = document.sections.map((entry) => {
      if (entry.id !== sectionId) return entry;
      const nextBlocks = [...entry.blocks];
      nextBlocks.splice(insertAt, 0, createdBlock);
      return { ...entry, blocks: nextBlocks };
    });

    commitDocument({ ...document, sections: nextSections });
    setSelectedSectionId(sectionId);
    setSelectedBlockId(createdBlock.id);
  }

  function removeBlock(sectionId: string, blockId: string) {
    if (!document) return;

    const nextSections = document.sections.map((section) => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        blocks: section.blocks.filter((block) => block.id !== blockId),
      };
    });

    commitDocument({ ...document, sections: nextSections });

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }

  function duplicateBlock(sectionId: string, blockId: string) {
    if (!document) return;

    const location = findBlockLocation(document, blockId);
    if (!location || location.sectionId !== sectionId) return;

    const sourceSection = document.sections[location.sectionIndex];
    const sourceBlock = sourceSection.blocks[location.blockIndex];
    if (!sourceBlock) return;

    const clone: BlockInstance = {
      ...sourceBlock,
      id: createId(),
      content: { ...sourceBlock.content },
    };

    const nextSections = document.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const nextBlocks = [...section.blocks];
      nextBlocks.splice(location.blockIndex + 1, 0, clone);
      return { ...section, blocks: nextBlocks };
    });

    commitDocument({ ...document, sections: nextSections });
    setSelectedSectionId(sectionId);
    setSelectedBlockId(clone.id);
  }

  function moveBlockToTarget(blockId: string, target: BlockLocation) {
    if (!document) return;

    const source = findBlockLocation(document, blockId);
    if (!source) return;

    const nextSections = document.sections.map((section) => ({
      ...section,
      blocks: [...section.blocks],
    }));

    const sourceSection = nextSections[source.sectionIndex];
    const targetSection = nextSections[target.sectionIndex];
    if (!sourceSection || !targetSection) return;

    const [moved] = sourceSection.blocks.splice(source.blockIndex, 1);
    if (!moved) return;

    let insertAt = target.blockIndex;
    if (source.sectionId === target.sectionId && source.blockIndex < target.blockIndex) {
      insertAt -= 1;
    }

    insertAt = Math.max(0, Math.min(insertAt, targetSection.blocks.length));
    targetSection.blocks.splice(insertAt, 0, moved);

    if (source.sectionId === target.sectionId && source.blockIndex === insertAt) {
      return;
    }

    commitDocument({
      ...document,
      sections: nextSections,
    });
    setSelectedSectionId(target.sectionId);
    setSelectedBlockId(moved.id);
  }

  function addPaletteBlockToSelectedSection(templateId: string) {
    if (!document || document.sections.length === 0) return;

    const targetSectionId = selectedSectionId ?? document.sections[0].id;
    const targetSection = document.sections.find((section) => section.id === targetSectionId);
    if (!targetSection) return;

    addBlockToSection(targetSectionId, templateId, targetSection.blocks.length);
  }

  function handleDragStart(event: DragStartEvent) {
    if (!document) return;

    const activeId = String(event.active.id);
    if (activeId.startsWith("palette:")) {
      const templateId = activeId.slice("palette:".length);
      const template = BUILDER_BLOCK_TEMPLATES.find((entry) => entry.id === templateId);
      setActiveDragLabel(template ? `New ${template.name}` : "New Block");
      return;
    }

    if (!activeId.startsWith("block:")) {
      setActiveDragLabel(null);
      return;
    }

    const blockId = activeId.slice("block:".length);
    const location = findBlockLocation(document, blockId);
    if (!location) {
      setActiveDragLabel(null);
      return;
    }

    const block = document.sections[location.sectionIndex]?.blocks[location.blockIndex] ?? null;
    setActiveDragLabel(block ? getBlockDisplayText(block) : "Block");
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!document) {
      setActiveDragLabel(null);
      return;
    }

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    setActiveDragLabel(null);

    if (!overId) return;

    const target = resolveDropTarget(document, overId);
    if (!target) return;

    if (activeId.startsWith("palette:")) {
      const templateId = activeId.slice("palette:".length);
      addBlockToSection(target.sectionId, templateId, target.blockIndex);
      return;
    }

    if (activeId.startsWith("block:")) {
      moveBlockToTarget(activeId.slice("block:".length), target);
    }
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 space-y-3">
          <p>Select a website page to open the visual builder with sidebar tools and draggable blocks.</p>
          {selectedSiteId ? (
            <button
              type="button"
              onClick={() => void createStarterPage()}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Create starter page
            </button>
          ) : null}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-12 gap-4">
            <aside className="col-span-12 lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-3 space-y-4">
              <div className="space-y-2">
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
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Content Blocks</h2>
                <p className="text-[11px] text-slate-500">
                  Drag blocks into the canvas, or tap to add to the selected section.
                </p>
                <div className="space-y-2">
                  {BUILDER_BLOCK_TEMPLATES.map((template) => (
                    <BuilderBlockPaletteItem
                      key={template.id}
                      template={template}
                      onAdd={() => addPaletteBlockToSelectedSection(template.id)}
                    />
                  ))}
                </div>
              </div>
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
                    const isSectionSelected = selectedSectionId === section.id;

                    return (
                      <BuilderSectionCanvas
                        key={section.id}
                        section={section}
                        title={manifest?.name ?? section.type}
                        description={section.label || manifest?.description || "Section"}
                        selectedSection={isSectionSelected}
                        selectedBlockId={selectedBlockId}
                        onSelectSection={() => {
                          setSelectedSectionId(section.id);
                          setSelectedBlockId(null);
                        }}
                        onSelectBlock={(blockId) => {
                          setSelectedSectionId(section.id);
                          setSelectedBlockId(blockId);
                        }}
                        onMoveSection={(direction) => moveSection(section.id, direction)}
                        onDuplicateSection={() => duplicateSection(section.id)}
                        onDeleteSection={() => removeSection(section.id)}
                        onDuplicateBlock={(blockId) => duplicateBlock(section.id, blockId)}
                        onDeleteBlock={(blockId) => removeBlock(section.id, blockId)}
                      />
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

          <DragOverlay dropAnimation={null}>
            {activeDragLabel ? (
              <div className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-lg">
                {activeDragLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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

function BuilderBlockPaletteItem({
  template,
  onAdd,
}: {
  template: BuilderBlockTemplate;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${template.id}`,
  });

  const style = transform
    ? {
      transform: CSS.Translate.toString(transform),
    }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      onClick={onAdd}
      className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${isDragging ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{template.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{template.description}</p>
        </div>
        <span
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 cursor-grab active:cursor-grabbing"
          title="Drag to canvas"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function BuilderSectionCanvas({
  section,
  title,
  description,
  selectedSection,
  selectedBlockId,
  onSelectSection,
  onSelectBlock,
  onMoveSection,
  onDuplicateSection,
  onDeleteSection,
  onDuplicateBlock,
  onDeleteBlock,
}: {
  section: SectionInstance;
  title: string;
  description: string;
  selectedSection: boolean;
  selectedBlockId: string | null;
  onSelectSection: () => void;
  onSelectBlock: (blockId: string) => void;
  onMoveSection: (direction: "up" | "down") => void;
  onDuplicateSection: () => void;
  onDeleteSection: () => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section.id}` });

  return (
    <article
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors ${selectedSection ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200 bg-white"} ${isOver ? "ring-2 ring-emerald-300" : ""}`}
      onClick={onSelectSection}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className="text-sm font-semibold text-slate-900">{description}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMoveSection("up");
            }}
            className="px-2 py-1 text-xs rounded border border-slate-300"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMoveSection("down");
            }}
            className="px-2 py-1 text-xs rounded border border-slate-300"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateSection();
            }}
            className="px-2 py-1 text-xs rounded border border-slate-300"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteSection();
            }}
            className="px-2 py-1 text-xs rounded border border-rose-300 text-rose-700"
          >
            Delete
          </button>
        </div>
      </div>

      <SortableContext items={section.blocks.map((block) => `block:${block.id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {section.blocks.length === 0 ? (
            <div className="rounded-md border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-4 text-center text-xs text-emerald-700">
              Drop content blocks here
            </div>
          ) : (
            section.blocks.map((block) => (
              <SortableBuilderBlock
                key={block.id}
                block={block}
                selected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </article>
  );
}

function SortableBuilderBlock({
  block,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  block: BlockInstance;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `block:${block.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${selected ? "border-emerald-400 bg-white" : "border-slate-200 bg-slate-50"} ${isDragging ? "opacity-75" : "opacity-100"}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 truncate text-left text-sm text-slate-700"
      >
        {getBlockDisplayText(block)}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDuplicate();
        }}
        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
      >
        Copy
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
      >
        Del
      </button>

      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 cursor-grab active:cursor-grabbing"
        title="Drag block"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
        </svg>
      </button>
    </div>
  );
}
