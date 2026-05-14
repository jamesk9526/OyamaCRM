/** Utility helpers for Webmaster visual editor state and document parsing. */
import { createDefaultPageSections } from "@/app/modules/webmaster/section-registry";
import type { SectionInstance } from "@/app/modules/webmaster/schema";
import type { DeviceMode, PageSettingsState, WebmasterDocument, WebmasterPage } from "./types";

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defaultPageSettings(page: WebmasterPage): PageSettingsState {
  return {
    title: page.title,
    slug: page.slug,
    path: page.path,
    status: page.status,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
  };
}

export function parseBuilderDocument(content: Record<string, unknown> | null): WebmasterDocument {
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

export function getDeviceCanvasClass(device: DeviceMode): string {
  if (device === "desktop") return "max-w-[1200px]";
  if (device === "tablet") return "max-w-3xl";
  return "max-w-sm";
}

export function getReadinessBadgeClass(status: "Working" | "Partially Working" | "Broken" | "Not Implemented"): string {
  if (status === "Working") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Partially Working") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Broken") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function calculateHealthScore(params: {
  document: WebmasterDocument | null;
  pageSettings: PageSettingsState | null;
}): { score: number; issueCount: number } {
  if (!params.document || !params.pageSettings) {
    return { score: 0, issueCount: 0 };
  }

  let issues = 0;
  if (!params.pageSettings.seoTitle.trim()) issues += 1;
  if (!params.pageSettings.seoDescription.trim()) issues += 1;
  if (params.document.sections.length === 0) issues += 2;
  if (params.document.sections.some((section) => section.blocks.length === 0)) issues += 1;

  return {
    score: Math.max(0, 100 - issues * 14),
    issueCount: issues,
  };
}
