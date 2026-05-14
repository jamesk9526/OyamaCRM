/** Right inspector panel for selected page, section, or block settings. */
"use client";

import type { BlockInstance, SectionInstance } from "@/app/modules/webmaster/schema";
import type { PageSettingsState } from "./types";

interface WebmasterEditorInspectorProps {
  pageSettings: PageSettingsState | null;
  selectedSection: SectionInstance | null;
  selectedBlock: BlockInstance | null;
  onUpdatePageSettings: (patch: Partial<PageSettingsState>) => void;
  onUpdateSection: (sectionId: string, updater: (section: SectionInstance) => SectionInstance) => void;
  onUpdateBlock: (sectionId: string, blockId: string, updater: (block: BlockInstance) => BlockInstance) => void;
}

/** Inspector prioritizes business-safe property editing while canvas stays WYSIWYG. */
export default function WebmasterEditorInspector(props: WebmasterEditorInspectorProps) {
  if (!props.pageSettings) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Select a page to open inspector settings.
      </aside>
    );
  }

  if (props.selectedBlock && props.selectedSection) {
    const block = props.selectedBlock;
    const section = props.selectedSection;

    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Edit Content</h3>
        <p className="text-xs text-slate-500">Block type: {block.type}</p>

        <label className="block text-xs text-slate-600">Text</label>
        <textarea
          rows={4}
          value={String(block.content.text ?? block.content.question ?? "")}
          onChange={(event) => {
            props.onUpdateBlock(section.id, block.id, (current) => ({
              ...current,
              content: {
                ...current.content,
                text: event.target.value,
                question: current.type === "faq-item" ? event.target.value : current.content.question,
              },
            }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs text-slate-600">Link (for buttons)</label>
        <input
          value={String(block.content.href ?? "")}
          onChange={(event) => {
            props.onUpdateBlock(section.id, block.id, (current) => ({
              ...current,
              content: {
                ...current.content,
                href: event.target.value,
              },
            }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs text-slate-600">Image alt text</label>
        <input
          value={String(block.content.alt ?? "")}
          onChange={(event) => {
            props.onUpdateBlock(section.id, block.id, (current) => ({
              ...current,
              content: {
                ...current.content,
                alt: event.target.value,
              },
            }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </aside>
    );
  }

  if (props.selectedSection) {
    const section = props.selectedSection;

    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Edit Section</h3>

        <label className="block text-xs text-slate-600">Section label</label>
        <input
          value={String(section.label ?? "")}
          onChange={(event) => {
            props.onUpdateSection(section.id, (current) => ({ ...current, label: event.target.value }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs text-slate-600">Variant</label>
        <input
          value={section.variant}
          onChange={(event) => {
            props.onUpdateSection(section.id, (current) => ({ ...current, variant: event.target.value }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs text-slate-600">Background color</label>
        <input
          value={String(section.settings.background ?? "")}
          onChange={(event) => {
            props.onUpdateSection(section.id, (current) => ({
              ...current,
              settings: {
                ...current.settings,
                background: event.target.value,
              },
            }));
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Page Settings</h3>

      <label className="block text-xs text-slate-600">Page title</label>
      <input
        value={props.pageSettings.title}
        onChange={(event) => props.onUpdatePageSettings({ title: event.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="block text-xs text-slate-600">Slug</label>
      <input
        value={props.pageSettings.slug}
        onChange={(event) => props.onUpdatePageSettings({ slug: event.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="block text-xs text-slate-600">Path</label>
      <input
        value={props.pageSettings.path}
        onChange={(event) => props.onUpdatePageSettings({ path: event.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="block text-xs text-slate-600">SEO title</label>
      <input
        value={props.pageSettings.seoTitle}
        onChange={(event) => props.onUpdatePageSettings({ seoTitle: event.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="block text-xs text-slate-600">SEO description</label>
      <textarea
        rows={4}
        value={props.pageSettings.seoDescription}
        onChange={(event) => props.onUpdatePageSettings({ seoDescription: event.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </aside>
  );
}
