/**
 * EmailBuilderApp — root client component for the email builder.
 *
 * Manages global state:
 *  - EmailTemplate (blocks + settings)
 *  - Selected block ID
 *  - Save / preview / loading states
 *
 * Orchestrates all three panels (BlockPalette, EmailCanvas, BlockEditor)
 * inside a single DndContext so drag operations can cross panel boundaries.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import type { EmailBlock, EmailTemplate, BlockType } from '@/app/lib/email-builder-types';
import {
  createDefaultBlock,
  createDefaultTemplate,
  createTemplateFromPreset,
  generateEmailHtml,
  generatePlainText,
  type TemplatePreset,
} from '@/app/lib/email-builder-utils';

import BlockPalette  from './BlockPalette';
import EmailCanvas   from './EmailCanvas';
import BlockEditor   from './BlockEditor';
import EmailPreview  from './EmailPreview';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Campaign ID from the `?campaign=` query param. */
  campaignId?: string;
}

// ─── DragOverlay ghost ────────────────────────────────────────────────────────

/**
 * Lightweight overlay rendered while a drag is in progress.
 * Shown instead of the original element to give a "ghost" effect.
 */
function DragGhost({ label }: { label: string }) {
  return (
    <div
      className="bg-white border-2 border-green-500 rounded-lg px-4 py-2 shadow-xl text-sm font-medium text-gray-700 opacity-90 pointer-events-none"
    >
      + {label}
    </div>
  );
}

// ─── EmailBuilderApp ──────────────────────────────────────────────────────────

export default function EmailBuilderApp({ campaignId }: Props) {
  // ── Template state ─────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<EmailTemplate>(createDefaultTemplate);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [showPreview,    setShowPreview]     = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [saveError,      setSaveError]       = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]     = useState(false);
  const [campaignName,   setCampaignName]    = useState('Email Campaign');
  const [preset,         setPreset]          = useState<TemplatePreset>('blank');
  const [dirty,          setDirty]           = useState(false);

  // ── Drag state (for DragOverlay label) ────────────────────────────────────
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  // ── Load campaign from API ─────────────────────────────────────────────────
  const [loadError, setLoadError] = useState<string | null>(null);
  /* Start in loading state when a campaignId is present so the first render
     shows the spinner without a synchronous setState call in the effect. */
  const [loading,   setLoading]   = useState(Boolean(campaignId));

  useEffect(() => {
    if (!campaignId) return;
    fetch(`${API_BASE}/api/email-campaigns/${campaignId}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const data = body.data ?? body;
        if (data.name)     setCampaignName(data.name);
        /* If the API returns a stored template JSON, restore the full editor state. */
        if (data.templateJson) {
          try {
            setTemplate(JSON.parse(data.templateJson) as EmailTemplate);
            setPreset('blank');
          } catch {
            /* ignore parse errors */
          }
        }
        setDirty(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Failed to load campaign: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  // ── Block helpers ──────────────────────────────────────────────────────────

  /** Immutably replace a block identified by id with a merged partial. */
  const updateBlock = useCallback((id: string, partial: Partial<EmailBlock>) => {
    setTemplate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === id ? ({ ...b, ...partial } as EmailBlock) : b
      ),
    }));
    setDirty(true);
  }, []);

  /** Remove a block by id. Also clears selection if that block was selected. */
  const deleteBlock = useCallback((id: string) => {
    setTemplate((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    setSelectedId((prev) => (prev === id ? null : prev));
    setDirty(true);
  }, []);

  /** Update top-level template properties (background, font, width). */
  const updateTemplate = useCallback((partial: Partial<EmailTemplate>) => {
    setTemplate((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }, []);

  // ── DnD sensors ───────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      /* Require an 8 px drag before activating — prevents accidental drags on click */
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const origin = active.data.current?.origin as string | undefined;
    if (origin === 'palette') {
      const blockType = active.data.current?.blockType as BlockType;
      setActiveLabel(blockType);
    } else {
      /* Canvas block — find its type for the overlay label */
      const block = template.blocks.find((b) => b.id === String(active.id));
      setActiveLabel(block?.type ?? null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLabel(null);

    if (!over) return;

    const origin      = active.data.current?.origin as string | undefined;
    const overId      = String(over.id);
    const overIsBlock = template.blocks.some((b) => b.id === overId);

    if (origin === 'palette') {
      /* ── Drop from palette: create a new block ── */
      const blockType = active.data.current?.blockType as BlockType;
      const newBlock  = createDefaultBlock(blockType);

      setTemplate((prev) => {
        const blocks = [...prev.blocks];
        if (!overIsBlock) {
          /* Dropped on the canvas background — append */
          blocks.push(newBlock);
        } else {
          /* Dropped on an existing block — insert after it */
          const overIndex = blocks.findIndex((b) => b.id === overId);
          blocks.splice(overIndex + 1, 0, newBlock);
        }
        return { ...prev, blocks };
      });
      setSelectedId(newBlock.id);
      setDirty(true);

    } else if (origin === 'canvas') {
      /* ── Canvas reorder ── */
      const activeId = String(active.id);
      if (activeId !== overId && overIsBlock) {
        setTemplate((prev) => {
          const oldIndex = prev.blocks.findIndex((b) => b.id === activeId);
          const newIndex = prev.blocks.findIndex((b) => b.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return { ...prev, blocks: arrayMove(prev.blocks, oldIndex, newIndex) };
        });
        setDirty(true);
      }
    }
  };

  /** Duplicates the currently selected block and inserts it below the original. */
  const duplicateSelectedBlock = () => {
    if (!selectedId) return;
    setTemplate((prev) => {
      const index = prev.blocks.findIndex((b) => b.id === selectedId);
      if (index === -1) return prev;
      const block = prev.blocks[index];
      const copy = createDefaultBlock(block.type);
      const duplicated = { ...block, id: copy.id } as EmailBlock;
      const blocks = [...prev.blocks];
      blocks.splice(index + 1, 0, duplicated);
      return { ...prev, blocks };
    });
    setDirty(true);
  };

  /** Replaces the current canvas with a starter preset template. */
  const applyPreset = () => {
    const next = createTemplateFromPreset(preset);
    setTemplate(next);
    setSelectedId(next.blocks[0]?.id ?? null);
    setDirty(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!campaignId) {
      setSaveError('No campaign ID — open this editor with ?campaign=ID');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const bodyHtml = generateEmailHtml(template);
      const bodyText = generatePlainText(template);
      const res = await fetch(`${API_BASE}/api/email-campaigns/${campaignId}`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ bodyHtml, bodyText, templateJson: JSON.stringify(template) }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
      }
      setSaveSuccess(true);
      setDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedBlock = template.blocks.find((b) => b.id === selectedId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading campaign…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-red-200 shadow p-8 max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h1 className="text-lg font-semibold text-gray-800">Could not load campaign</h1>
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-sm text-gray-500">
            You can still use the editor — changes cannot be saved without a valid campaign ID.
          </p>
          <button
            onClick={() => setLoadError(null)}
            className="mt-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Continue anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-white overflow-hidden">

        {/* ── Top Bar ── */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shadow-sm z-30">
          {/* Left: back link + campaign name */}
          <div className="flex items-center gap-3">
            <a
              href="/communications"
              target="_self"
              className="text-xs text-gray-500 hover:text-green-600 transition-colors flex items-center gap-1"
              title="Back to OyamaCRM"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              OyamaCRM
            </a>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
              {campaignName}
            </span>
            {campaignId && (
              <span className="text-xs text-gray-400 font-mono">#{campaignId}</span>
            )}
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center gap-3">
            {/* Save status messages */}
            {saveSuccess && (
              <span className="text-xs text-green-600 font-medium">✓ Saved</span>
            )}
            {saveError && (
              <span
                className="text-xs text-red-500 max-w-xs truncate cursor-help"
                title={saveError}
              >
                ⚠ {saveError}
              </span>
            )}

            {/* Block count badge */}
            <span className="text-xs text-gray-400">
              {template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}
            </span>
            <span className={`text-xs font-medium ${dirty ? "text-amber-600" : "text-gray-400"}`}>
              {dirty ? "Unsaved changes" : "Saved"}
            </span>

            {/* Preset picker */}
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as TemplatePreset)}
              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white"
            >
              <option value="blank">Blank</option>
              <option value="newsletter">Newsletter</option>
              <option value="appeal">Donation Appeal</option>
              <option value="event">Event Invite</option>
            </select>
            <button
              onClick={applyPreset}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Apply preset
            </button>

            {selectedId && (
              <button
                onClick={duplicateSelectedBlock}
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Duplicate block
              </button>
            )}

            {/* Preview */}
            <button
              onClick={() => setShowPreview(true)}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Preview
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={[
                'text-sm px-4 py-1.5 rounded-lg font-medium transition-colors',
                saving
                  ? 'bg-green-400 text-white cursor-wait'
                  : 'bg-green-600 hover:bg-green-700 text-white',
              ].join(' ')}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        {/* ── Three-panel body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: block palette */}
          <BlockPalette />

          {/* Center: email canvas */}
          <EmailCanvas
            template={template}
            selectedId={selectedId}
            onSelectBlock={setSelectedId}
            onDeleteBlock={deleteBlock}
          />

          {/* Right: block editor */}
          <BlockEditor
            selectedBlock={selectedBlock}
            template={template}
            onUpdateBlock={updateBlock}
            onUpdateTemplate={updateTemplate}
          />
        </div>
      </div>

      {/* Drag overlay — ghost shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeLabel ? <DragGhost label={activeLabel} /> : null}
      </DragOverlay>

      {/* Preview modal */}
      {showPreview && (
        <EmailPreview
          template={template}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndContext>
  );
}
