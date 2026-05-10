/**
 * BlockEditor — right panel
 *
 * Shows a property form for the currently-selected block.
 * All changes are applied in real-time via the onUpdate callback.
 *
 * Also contains a global "Template Settings" section for background
 * colour, content width, and font family when no block is selected.
 */

'use client';

import { useCallback } from 'react';
import type {
  EmailBlock,
  EmailTemplate,
  TextBlock,
  QuoteBlock,
  ImpactStatBlock,
  ImageBlock,
  VideoBlock,
  ButtonBlock,
  AiTextBlock,
  AiButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  ColumnsBlock,
  SocialPlatform,
} from '@/app/lib/email-builder-types';
import { parseVideoUrl } from '@/app/lib/email-builder-utils';

// ─── Shared field primitives ──────────────────────────────────────────────────

interface FieldProps {
  label:    string;
  children: React.ReactNode;
  hint?:    string;
}

/** Labelled form field wrapper. */
function Field({ label, children, hint }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'block w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent';
const selectCls = inputCls;

// ─── Per-type editors ─────────────────────────────────────────────────────────

function TextEditor({
  block,
  onUpdate,
}: {
  block: TextBlock;
  onUpdate: (partial: Partial<TextBlock>) => void;
}) {
  return (
    <>
      <Field label="Content (HTML)">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={6}
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
        />
      </Field>
      <Field label="Font Size (px)">
        <input
          type="number"
          className={inputCls}
          min={8}
          max={72}
          value={block.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
        />
      </Field>
      <Field label="Text Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as TextBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function QuoteEditor({
  block,
  onUpdate,
}: {
  block: QuoteBlock;
  onUpdate: (partial: Partial<QuoteBlock>) => void;
}) {
  return (
    <>
      <Field label="Quote Text">
        <textarea
          className={inputCls}
          rows={4}
          value={block.quote}
          onChange={(e) => onUpdate({ quote: e.target.value })}
        />
      </Field>
      <Field label="Attribution">
        <input
          type="text"
          className={inputCls}
          placeholder="Donor Name, Family, or Group"
          value={block.attribution}
          onChange={(e) => onUpdate({ attribution: e.target.value })}
        />
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as QuoteBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ImpactStatEditor({
  block,
  onUpdate,
}: {
  block: ImpactStatBlock;
  onUpdate: (partial: Partial<ImpactStatBlock>) => void;
}) {
  return (
    <>
      <Field label="Impact Value">
        <input
          type="text"
          className={inputCls}
          value={block.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
        />
      </Field>
      <Field label="Impact Label">
        <input
          type="text"
          className={inputCls}
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </Field>
      <Field label="Sublabel" hint="Optional support text beneath the primary metric">
        <input
          type="text"
          className={inputCls}
          value={block.sublabel ?? ''}
          onChange={(e) => onUpdate({ sublabel: e.target.value || undefined })}
        />
      </Field>
      <Field label="Card Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Text Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ImageEditor({
  block,
  onUpdate,
}: {
  block: ImageBlock;
  onUpdate: (partial: Partial<ImageBlock>) => void;
}) {
  return (
    <>
      <Field label="Image URL">
        <input
          type="url"
          className={inputCls}
          placeholder="https://example.com/image.jpg"
          value={block.src}
          onChange={(e) => onUpdate({ src: e.target.value })}
        />
      </Field>
      <Field label="Alt Text">
        <input
          type="text"
          className={inputCls}
          placeholder="Describe the image"
          value={block.alt}
          onChange={(e) => onUpdate({ alt: e.target.value })}
        />
      </Field>
      <Field label={`Width: ${block.width}%`}>
        <input
          type="range"
          className="w-full accent-green-600"
          min={10}
          max={100}
          step={5}
          value={block.width}
          onChange={(e) => onUpdate({ width: Number(e.target.value) })}
        />
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as ImageBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Click-through URL" hint="Optional — wraps the image in a link">
        <input
          type="url"
          className={inputCls}
          placeholder="https://"
          value={block.link ?? ''}
          onChange={(e) => onUpdate({ link: e.target.value || undefined })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function VideoEditor({
  block,
  onUpdate,
}: {
  block: VideoBlock;
  onUpdate: (partial: Partial<VideoBlock>) => void;
}) {
  const handleUrlChange = (url: string) => {
    const parsed = parseVideoUrl(url);
    onUpdate({
      url,
      embedType:    parsed.embedType,
      thumbnailUrl: parsed.thumbnailUrl,
    });
  };

  return (
    <>
      <Field
        label="Video URL"
        hint="Paste a YouTube, Vimeo, OneDrive, or generic video URL"
      >
        <input
          type="url"
          className={inputCls}
          placeholder="https://www.youtube.com/watch?v=..."
          value={block.url}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
      </Field>
      {block.url && (
        <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
          Detected: <strong>{block.embedType}</strong>
        </div>
      )}
      <Field label="Thumbnail URL" hint="Auto-set for YouTube; override here">
        <input
          type="url"
          className={inputCls}
          placeholder="https://..."
          value={block.thumbnailUrl ?? ''}
          onChange={(e) => onUpdate({ thumbnailUrl: e.target.value || undefined })}
        />
      </Field>
      <Field label="Caption" hint="Optional text below the video">
        <input
          type="text"
          className={inputCls}
          placeholder="Optional caption"
          value={block.caption ?? ''}
          onChange={(e) => onUpdate({ caption: e.target.value || undefined })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ButtonEditor({
  block,
  onUpdate,
}: {
  block: ButtonBlock;
  onUpdate: (partial: Partial<ButtonBlock>) => void;
}) {
  return (
    <>
      <Field label="Button Label">
        <input
          type="text"
          className={inputCls}
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </Field>
      <Field label="URL (href)">
        <input
          type="url"
          className={inputCls}
          placeholder="https://"
          value={block.href}
          onChange={(e) => onUpdate({ href: e.target.value })}
        />
      </Field>
      <Field label="Background Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Text Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as ButtonBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Border Radius (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={50}
          value={block.borderRadius}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function AiTextEditor({
  block,
  onUpdate,
  onGenerate,
  generating,
}: {
  block: AiTextBlock;
  onUpdate: (partial: Partial<AiTextBlock>) => void;
  onGenerate?: () => void;
  generating: boolean;
}) {
  return (
    <>
      <Field
        label="AI Prompt"
        hint="Describe what this section should communicate to your constituents."
      >
        <textarea
          className={inputCls}
          rows={3}
          value={block.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
        />
      </Field>
      <Field label="Tone">
        <select
          className={selectCls}
          value={block.tone}
          onChange={(e) => onUpdate({ tone: e.target.value as AiTextBlock['tone'] })}
        >
          <option value="warm">Warm</option>
          <option value="informative">Informative</option>
          <option value="celebratory">Celebratory</option>
          <option value="urgent">Urgent</option>
        </select>
      </Field>
      <button
        type="button"
        disabled={generating || !block.prompt.trim() || !onGenerate}
        onClick={onGenerate}
        className="w-full rounded-lg bg-green-600 text-white text-sm font-semibold py-2 hover:bg-green-700 disabled:opacity-60"
      >
        {generating ? 'Generating AI Text...' : 'Generate with AI'}
      </button>
      <Field label="Generated HTML Content">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={7}
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function AiButtonEditor({
  block,
  onUpdate,
  onGenerate,
  generating,
}: {
  block: AiButtonBlock;
  onUpdate: (partial: Partial<AiButtonBlock>) => void;
  onGenerate?: () => void;
  generating: boolean;
}) {
  return (
    <>
      <Field label="AI Prompt" hint="Explain the action you want donors to take.">
        <textarea
          className={inputCls}
          rows={3}
          value={block.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
        />
      </Field>
      <button
        type="button"
        disabled={generating || !block.prompt.trim() || !onGenerate}
        onClick={onGenerate}
        className="w-full rounded-lg bg-green-600 text-white text-sm font-semibold py-2 hover:bg-green-700 disabled:opacity-60"
      >
        {generating ? 'Generating AI CTA...' : 'Generate CTA with AI'}
      </button>
      <Field label="Button Label">
        <input
          type="text"
          className={inputCls}
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </Field>
      <Field label="URL (href)">
        <input
          type="url"
          className={inputCls}
          placeholder="https://"
          value={block.href}
          onChange={(e) => onUpdate({ href: e.target.value })}
        />
      </Field>
      <Field label="Background Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.bgColor}
            onChange={(e) => onUpdate({ bgColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Text Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.textColor}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as AiButtonBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Border Radius (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={50}
          value={block.borderRadius}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function DividerEditor({
  block,
  onUpdate,
}: {
  block: DividerBlock;
  onUpdate: (partial: Partial<DividerBlock>) => void;
}) {
  return (
    <>
      <Field label="Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Thickness (px)">
        <input
          type="number"
          className={inputCls}
          min={1}
          max={20}
          value={block.thickness}
          onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function SpacerEditor({
  block,
  onUpdate,
}: {
  block: SpacerBlock;
  onUpdate: (partial: Partial<SpacerBlock>) => void;
}) {
  return (
    <Field label={`Height: ${block.height}px`}>
      <input
        type="range"
        className="w-full accent-green-600"
        min={4}
        max={200}
        step={4}
        value={block.height}
        onChange={(e) => onUpdate({ height: Number(e.target.value) })}
      />
      <input
        type="number"
        className={`${inputCls} mt-1`}
        min={4}
        max={200}
        value={block.height}
        onChange={(e) => onUpdate({ height: Number(e.target.value) })}
      />
    </Field>
  );
}

const ALL_PLATFORMS: SocialPlatform[] = [
  'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
];

function SocialEditor({
  block,
  onUpdate,
}: {
  block: SocialBlock;
  onUpdate: (partial: Partial<SocialBlock>) => void;
}) {
  const updateLink = (platform: SocialPlatform, url: string) => {
    const existing = block.links.find((l) => l.platform === platform);
    if (existing) {
      onUpdate({
        links: block.links.map((l) =>
          l.platform === platform ? { platform, url } : l
        ),
      });
    } else {
      onUpdate({ links: [...block.links, { platform, url }] });
    }
  };

  const togglePlatform = (platform: SocialPlatform, enabled: boolean) => {
    if (enabled) {
      onUpdate({ links: [...block.links, { platform, url: `https://${platform}.com` }] });
    } else {
      onUpdate({ links: block.links.filter((l) => l.platform !== platform) });
    }
  };

  return (
    <>
      <div className="space-y-3">
        {ALL_PLATFORMS.map((platform) => {
          const link = block.links.find((l) => l.platform === platform);
          return (
            <div key={platform} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`social-${platform}`}
                  checked={!!link}
                  className="accent-green-600"
                  onChange={(e) => togglePlatform(platform, e.target.checked)}
                />
                <label
                  htmlFor={`social-${platform}`}
                  className="text-xs font-semibold text-gray-700 capitalize"
                >
                  {platform}
                </label>
              </div>
              {link && (
                <input
                  type="url"
                  className={inputCls}
                  placeholder={`https://${platform}.com/...`}
                  value={link.url}
                  onChange={(e) => updateLink(platform, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as SocialBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function ColumnsEditor({
  block,
  onUpdate,
}: {
  block: ColumnsBlock;
  onUpdate: (partial: Partial<ColumnsBlock>) => void;
}) {
  const updateColText = (colIndex: number, html: string) => {
    const cols = block.columns.map((col, i) => {
      if (i !== colIndex) return col;
      if (col.length === 0) {
        return [
          {
            id:      crypto.randomUUID(),
            type:    'text' as const,
            content: html,
            fontSize: 14,
            color:   '#333333',
            align:   'left' as const,
            padding: 8,
          },
        ];
      }
      return col.map((b, bi) =>
        bi === 0 && b.type === 'text' ? { ...b, content: html } : b
      );
    });
    onUpdate({ columns: cols });
  };

  const col0Text = block.columns[0]?.[0]?.type === 'text'
    ? (block.columns[0][0] as TextBlock).content
    : '';
  const col1Text = block.columns[1]?.[0]?.type === 'text'
    ? (block.columns[1][0] as TextBlock).content
    : '';

  return (
    <>
      <Field label="Column 1 (HTML)">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={4}
          value={col0Text}
          onChange={(e) => updateColText(0, e.target.value)}
        />
      </Field>
      <Field label="Column 2 (HTML)">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={4}
          value={col1Text}
          onChange={(e) => updateColText(1, e.target.value)}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputCls}
          min={0}
          max={100}
          value={block.padding}
          onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

// ─── Template Settings ────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  'Arial, Helvetica, sans-serif',
  'Georgia, \'Times New Roman\', serif',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, sans-serif',
  '\'Courier New\', monospace',
];

interface TemplateSettingsProps {
  template: EmailTemplate;
  onUpdateTemplate: (partial: Partial<EmailTemplate>) => void;
}

/** Shown in the right panel when no block is selected. */
function TemplateSettings({ template, onUpdateTemplate }: TemplateSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 text-center pt-1">
        Click a block to edit it, or adjust global settings below.
      </p>
      <hr className="border-gray-200" />
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Template Settings
      </p>
      <Field label="Background Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={template.backgroundColor}
            onChange={(e) => onUpdateTemplate({ backgroundColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={template.backgroundColor}
            onChange={(e) => onUpdateTemplate({ backgroundColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Content Width (px)">
        <input
          type="number"
          className={inputCls}
          min={320}
          max={900}
          step={20}
          value={template.contentWidth}
          onChange={(e) => onUpdateTemplate({ contentWidth: Number(e.target.value) })}
        />
      </Field>
      <Field label="Font Family">
        <select
          className={selectCls}
          value={template.fontFamily}
          onChange={(e) => onUpdateTemplate({ fontFamily: e.target.value })}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f.split(',')[0].replace(/'/g, '')}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ─── BlockEditor ──────────────────────────────────────────────────────────────

interface Props {
  selectedBlock:    EmailBlock | null;
  template:         EmailTemplate;
  onUpdateBlock:    (id: string, partial: Partial<EmailBlock>) => void;
  onUpdateTemplate: (partial: Partial<EmailTemplate>) => void;
  onGenerateAiBlock?: (id: string) => void;
  aiGeneratingBlockId?: string | null;
}

/**
 * Right panel — renders a type-specific property form for the selected block,
 * or Template Settings when nothing is selected.
 */
export default function BlockEditor({
  selectedBlock,
  template,
  onUpdateBlock,
  onUpdateTemplate,
  onGenerateAiBlock,
  aiGeneratingBlockId,
}: Props) {
  /* Stable update helper so child editors don't need the block id. */
  const update = useCallback(
    (partial: Partial<EmailBlock>) => {
      if (selectedBlock) onUpdateBlock(selectedBlock.id, partial);
    },
    [selectedBlock, onUpdateBlock]
  );

  return (
    <aside className="w-[300px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {selectedBlock
            ? `Edit: ${selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)}`
            : 'Properties'}
        </h2>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!selectedBlock ? (
          <TemplateSettings
            template={template}
            onUpdateTemplate={onUpdateTemplate}
          />
        ) : (
          <>
            {selectedBlock.type === 'text' && (
              <TextEditor
                block={selectedBlock as TextBlock}
                onUpdate={update as (p: Partial<TextBlock>) => void}
              />
            )}
            {selectedBlock.type === 'quote' && (
              <QuoteEditor
                block={selectedBlock as QuoteBlock}
                onUpdate={update as (p: Partial<QuoteBlock>) => void}
              />
            )}
            {selectedBlock.type === 'impactStat' && (
              <ImpactStatEditor
                block={selectedBlock as ImpactStatBlock}
                onUpdate={update as (p: Partial<ImpactStatBlock>) => void}
              />
            )}
            {selectedBlock.type === 'image' && (
              <ImageEditor
                block={selectedBlock as ImageBlock}
                onUpdate={update as (p: Partial<ImageBlock>) => void}
              />
            )}
            {selectedBlock.type === 'video' && (
              <VideoEditor
                block={selectedBlock as VideoBlock}
                onUpdate={update as (p: Partial<VideoBlock>) => void}
              />
            )}
            {selectedBlock.type === 'button' && (
              <ButtonEditor
                block={selectedBlock as ButtonBlock}
                onUpdate={update as (p: Partial<ButtonBlock>) => void}
              />
            )}
            {selectedBlock.type === 'aiText' && (
              <AiTextEditor
                block={selectedBlock as AiTextBlock}
                onUpdate={update as (p: Partial<AiTextBlock>) => void}
                onGenerate={onGenerateAiBlock ? () => onGenerateAiBlock(selectedBlock.id) : undefined}
                generating={aiGeneratingBlockId === selectedBlock.id}
              />
            )}
            {selectedBlock.type === 'aiButton' && (
              <AiButtonEditor
                block={selectedBlock as AiButtonBlock}
                onUpdate={update as (p: Partial<AiButtonBlock>) => void}
                onGenerate={onGenerateAiBlock ? () => onGenerateAiBlock(selectedBlock.id) : undefined}
                generating={aiGeneratingBlockId === selectedBlock.id}
              />
            )}
            {selectedBlock.type === 'divider' && (
              <DividerEditor
                block={selectedBlock as DividerBlock}
                onUpdate={update as (p: Partial<DividerBlock>) => void}
              />
            )}
            {selectedBlock.type === 'spacer' && (
              <SpacerEditor
                block={selectedBlock as SpacerBlock}
                onUpdate={update as (p: Partial<SpacerBlock>) => void}
              />
            )}
            {selectedBlock.type === 'social' && (
              <SocialEditor
                block={selectedBlock as SocialBlock}
                onUpdate={update as (p: Partial<SocialBlock>) => void}
              />
            )}
            {selectedBlock.type === 'columns' && (
              <ColumnsEditor
                block={selectedBlock as ColumnsBlock}
                onUpdate={update as (p: Partial<ColumnsBlock>) => void}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
