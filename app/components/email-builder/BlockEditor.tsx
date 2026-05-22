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

import { useCallback, useRef, useState } from 'react';
import type {
  EmailBlock,
  EmailTemplate,
  HeadingBlock,
  TextBlock,
  QuoteBlock,
  ImpactStatBlock,
  ImpactStoryBlock,
  ImpactGridBlock,
  ProgressBlock,
  TimelineBlock,
  CalloutBlock,
  FeatureListBlock,
  DonorThankYouBlock,
  DonationReceiptBlock,
  GivingSummaryBlock,
  DonationCtaBlock,
  MonthlyDonorInvitationBlock,
  LapsedDonorReengagementBlock,
  FirstTimeDonorWelcomeBlock,
  StaffSignatureBlock,
  FooterComplianceBlock,
  ImageBlock,
  VideoBlock,
  ButtonBlock,
  AiTextBlock,
  AiButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  ColumnsBlock,
  CustomHtmlBlock,
  SocialPlatform,
} from '@/app/lib/email-builder-types';
import { parseVideoUrl } from '@/app/lib/email-builder-utils';
import RichTextEditor from '@/app/components/email-builder/RichTextEditor';

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
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'block w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const selectCls = inputCls;

type InspectorTab = 'content' | 'style' | 'settings';

interface TemplatePanelProps {
  template: EmailTemplate;
  onUpdateTemplate: (partial: Partial<EmailTemplate>) => void;
}

interface QuickColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function QuickColorField({ label, value, onChange }: QuickColorFieldProps) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-9 w-11 rounded border border-slate-200 cursor-pointer p-0.5"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          className={`${inputCls} flex-1`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

function EmptyInspectorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

function InspectorSection({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {body ? <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function AlignmentSegmentedControl({
  value,
  onChange,
}: {
  value: 'left' | 'center' | 'right';
  onChange: (value: 'left' | 'center' | 'right') => void;
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm font-semibold">
      {([
        ['left', 'Left'],
        ['center', 'Center'],
        ['right', 'Right'],
      ] as const).map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={[
            'border-r border-slate-200 px-2 py-2 last:border-r-0 transition-colors',
            value === option ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BlockStyleQuickPanel({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (partial: Partial<EmailBlock>) => void;
}) {
  const hasStyleFields =
    'align' in block
    || 'fontSize' in block
    || 'color' in block
    || 'textColor' in block
    || 'bgColor' in block
    || 'accentColor' in block
    || 'borderColor' in block
    || 'buttonColor' in block
    || 'buttonTextColor' in block
    || 'barColor' in block
    || 'trackColor' in block;

  return (
    <div className="space-y-4">
      {'align' in block && (
        <Field label="Alignment">
          <AlignmentSegmentedControl
            value={block.align}
            onChange={(value) => onUpdate({ align: value } as Partial<EmailBlock>)}
          />
        </Field>
      )}
      {'fontSize' in block && (
        <Field label="Font Size (px)">
          <input
            type="number"
            className={inputCls}
            min={8}
            max={72}
            value={block.fontSize}
            onChange={(event) => onUpdate({ fontSize: Number(event.target.value) } as Partial<EmailBlock>)}
          />
        </Field>
      )}
      {'color' in block && (
        <QuickColorField
          label="Text Color"
          value={block.color}
          onChange={(value) => onUpdate({ color: value } as Partial<EmailBlock>)}
        />
      )}
      {'textColor' in block && (
        <QuickColorField
          label="Text Color"
          value={block.textColor}
          onChange={(value) => onUpdate({ textColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'bgColor' in block && (
        <QuickColorField
          label="Surface Color"
          value={block.bgColor}
          onChange={(value) => onUpdate({ bgColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'accentColor' in block && (
        <QuickColorField
          label="Accent Color"
          value={block.accentColor}
          onChange={(value) => onUpdate({ accentColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'borderColor' in block && (
        <QuickColorField
          label="Border Color"
          value={block.borderColor}
          onChange={(value) => onUpdate({ borderColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'buttonColor' in block && (
        <QuickColorField
          label="Button Color"
          value={block.buttonColor}
          onChange={(value) => onUpdate({ buttonColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'buttonTextColor' in block && (
        <QuickColorField
          label="Button Text Color"
          value={block.buttonTextColor}
          onChange={(value) => onUpdate({ buttonTextColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'barColor' in block && (
        <QuickColorField
          label="Bar Color"
          value={block.barColor}
          onChange={(value) => onUpdate({ barColor: value } as Partial<EmailBlock>)}
        />
      )}
      {'trackColor' in block && (
        <QuickColorField
          label="Track Color"
          value={block.trackColor}
          onChange={(value) => onUpdate({ trackColor: value } as Partial<EmailBlock>)}
        />
      )}
      {!hasStyleFields && (
        <EmptyInspectorState
          title="No quick style controls"
          body="This block uses its content editor for most visual settings. Use the Content tab for deeper customization."
        />
      )}
    </div>
  );
}

function BlockSettingsQuickPanel({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (partial: Partial<EmailBlock>) => void;
}) {
  return (
    <div className="space-y-4">
      {'padding' in block && (
        <Field label="Padding (px)">
          <input
            type="number"
            className={inputCls}
            min={0}
            max={120}
            value={block.padding}
            onChange={(event) => onUpdate({ padding: Number(event.target.value) } as Partial<EmailBlock>)}
          />
        </Field>
      )}
      {'height' in block && (
        <Field label="Height (px)">
          <input
            type="number"
            className={inputCls}
            min={4}
            max={200}
            value={block.height}
            onChange={(event) => onUpdate({ height: Number(event.target.value) } as Partial<EmailBlock>)}
          />
        </Field>
      )}
      {'thickness' in block && (
        <Field label="Divider Thickness (px)">
          <input
            type="number"
            className={inputCls}
            min={1}
            max={12}
            value={block.thickness}
            onChange={(event) => onUpdate({ thickness: Number(event.target.value) } as Partial<EmailBlock>)}
          />
        </Field>
      )}
      {'columnCount' in block && (
        <Field label="Columns">
          <select
            className={selectCls}
            value={block.columnCount ?? 2}
            onChange={(event) => onUpdate({ columnCount: Number(event.target.value) as 2 | 3 } as Partial<EmailBlock>)}
          >
            <option value={2}>2 columns</option>
            <option value={3}>3 columns</option>
          </select>
        </Field>
      )}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <span className="font-semibold text-slate-700">Block Type</span>
          <span className="rounded bg-white px-2 py-1 font-medium text-slate-600">{block.type}</span>
        </div>
        <div className="mt-2 break-all text-xs text-slate-400">
          Block ID: {block.id}
        </div>
      </div>
    </div>
  );
}

function EmailWideStylePanel({ template, onUpdateTemplate }: TemplatePanelProps) {
  return (
    <InspectorSection
      title="Email-Wide Style"
      body="These controls apply to the current builder session and affect the full email canvas."
    >
      <QuickColorField
        label="Background Color"
        value={template.backgroundColor}
        onChange={(value) => onUpdateTemplate({ backgroundColor: value })}
      />
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
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
        Changing the font here updates the whole email preview for this builder session.
      </div>
    </InspectorSection>
  );
}

function EmailWideSettingsPanel({ template, onUpdateTemplate }: TemplatePanelProps) {
  return (
    <InspectorSection
      title="Email-Wide Settings"
      body="Use these layout controls to keep the overall email compact and consistent."
    >
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
      <EmptyInspectorState
        title="Builder session settings"
        body="These settings stay with the template state while you work, so you can change email-wide typography and width without deselecting blocks."
      />
    </InspectorSection>
  );
}

// ─── Per-type editors ─────────────────────────────────────────────────────────

function TextEditor({
  block,
  onUpdate,
  templateFontFamily,
}: {
  block: TextBlock;
  onUpdate: (partial: Partial<TextBlock>) => void;
  templateFontFamily?: string;
}) {
  return (
    <>
      <Field label="Content">
        <RichTextEditor
          value={block.content}
          onChange={(content) => onUpdate({ content })}
          fontFamily={templateFontFamily}
          htmlEnabled={!!block.htmlEditingEnabled}
          onToggleHtmlEnabled={(enabled) => onUpdate({ htmlEditingEnabled: enabled })}
          htmlLabel="Enable raw HTML editor for this block"
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

function CustomHtmlEditor({
  block,
  onUpdate,
}: {
  block: CustomHtmlBlock;
  onUpdate: (partial: Partial<CustomHtmlBlock>) => void;
}) {
  return (
    <>
      <Field label="Custom HTML" hint="Rendered directly in email output. Keep markup email-safe.">
        <textarea
          className={inputCls}
          rows={14}
          value={block.html}
          onChange={(e) => onUpdate({ html: e.target.value })}
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

function HeadingEditor({
  block,
  onUpdate,
}: {
  block: HeadingBlock;
  onUpdate: (partial: Partial<HeadingBlock>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <input
          type="text"
          className={inputCls}
          value={block.eyebrow ?? ''}
          onChange={(e) => onUpdate({ eyebrow: e.target.value || undefined })}
        />
      </Field>
      <Field label="Title">
        <input
          type="text"
          className={inputCls}
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </Field>
      <Field label="Subtitle">
        <textarea
          className={inputCls}
          rows={3}
          value={block.subtitle ?? ''}
          onChange={(e) => onUpdate({ subtitle: e.target.value || undefined })}
        />
      </Field>
      <Field label="Alignment">
        <select
          className={selectCls}
          value={block.align}
          onChange={(e) => onUpdate({ align: e.target.value as HeadingBlock['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
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

function ImpactGridEditor({
  block,
  onUpdate,
}: {
  block: ImpactGridBlock;
  onUpdate: (partial: Partial<ImpactGridBlock>) => void;
}) {
  const serializedItems = block.items.map((item) => `${item.value}|${item.label}`).join('\n');

  return (
    <>
      <Field label="Title">
        <input
          type="text"
          className={inputCls}
          value={block.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
        />
      </Field>
      <Field label="Metrics" hint="One per line: value|label">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={6}
          value={serializedItems}
          onChange={(e) => {
            const items = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [value, ...labelParts] = line.split('|');
                return {
                  value: value?.trim() ?? '',
                  label: labelParts.join('|').trim() || 'Impact',
                };
              })
              .slice(0, 4);
            onUpdate({ items });
          }}
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
      <Field label="Accent Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
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

function ProgressEditor({
  block,
  onUpdate,
}: {
  block: ProgressBlock;
  onUpdate: (partial: Partial<ProgressBlock>) => void;
}) {
  return (
    <>
      <Field label="Label">
        <input
          type="text"
          className={inputCls}
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </Field>
      <Field label="Current Amount">
        <input
          type="number"
          className={inputCls}
          min={0}
          value={block.current}
          onChange={(e) => onUpdate({ current: Number(e.target.value) })}
        />
      </Field>
      <Field label="Goal Amount">
        <input
          type="number"
          className={inputCls}
          min={1}
          value={block.goal}
          onChange={(e) => onUpdate({ goal: Number(e.target.value) })}
        />
      </Field>
      <Field label="Bar Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.barColor}
            onChange={(e) => onUpdate({ barColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.barColor}
            onChange={(e) => onUpdate({ barColor: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Track Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.trackColor}
            onChange={(e) => onUpdate({ trackColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.trackColor}
            onChange={(e) => onUpdate({ trackColor: e.target.value })}
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

function TimelineEditor({
  block,
  onUpdate,
}: {
  block: TimelineBlock;
  onUpdate: (partial: Partial<TimelineBlock>) => void;
}) {
  const serializedItems = block.items.map((item) => `${item.title}|${item.detail ?? ''}`).join('\n');

  return (
    <>
      <Field label="Title">
        <input
          type="text"
          className={inputCls}
          value={block.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
        />
      </Field>
      <Field label="Timeline Items" hint="One per line: title|detail">
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={7}
          value={serializedItems}
          onChange={(e) => {
            const items = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [title, ...detailParts] = line.split('|');
                return {
                  title: title?.trim() ?? 'Milestone',
                  detail: detailParts.join('|').trim() || undefined,
                };
              })
              .slice(0, 6);
            onUpdate({ items });
          }}
        />
      </Field>
      <Field label="Accent Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.accentColor}
            onChange={(e) => onUpdate({ accentColor: e.target.value })}
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

function CalloutEditor({
  block,
  onUpdate,
}: {
  block: CalloutBlock;
  onUpdate: (partial: Partial<CalloutBlock>) => void;
}) {
  return (
    <>
      <Field label="Title">
        <input
          type="text"
          className={inputCls}
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </Field>
      <Field label="Body">
        <textarea
          className={inputCls}
          rows={5}
          value={block.body}
          onChange={(e) => onUpdate({ body: e.target.value })}
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
      <Field label="Border Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.borderColor}
            onChange={(e) => onUpdate({ borderColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.borderColor}
            onChange={(e) => onUpdate({ borderColor: e.target.value })}
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

function FeatureListEditor({
  block,
  onUpdate,
}: {
  block: FeatureListBlock;
  onUpdate: (partial: Partial<FeatureListBlock>) => void;
}) {
  return (
    <>
      <Field label="Title">
        <input
          type="text"
          className={inputCls}
          value={block.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
        />
      </Field>
      <Field label="List Items" hint="One item per line">
        <textarea
          className={inputCls}
          rows={7}
          value={block.items.join('\n')}
          onChange={(e) => onUpdate({ items: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8) })}
        />
      </Field>
      <Field label="Bullet Color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
            value={block.bulletColor}
            onChange={(e) => onUpdate({ bulletColor: e.target.value })}
          />
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={block.bulletColor}
            onChange={(e) => onUpdate({ bulletColor: e.target.value })}
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

function ImpactStoryEditor({
  block,
  onUpdate,
}: {
  block: ImpactStoryBlock;
  onUpdate: (partial: Partial<ImpactStoryBlock>) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Use only approved, privacy-safe stories. Do not include protected client-identifying details.
      </div>
      <Field label="Headline">
        <input type="text" className={inputCls} value={block.headline} onChange={(e) => onUpdate({ headline: e.target.value })} />
      </Field>
      <Field label="Story Text">
        <textarea className={inputCls} rows={5} value={block.story} onChange={(e) => onUpdate({ story: e.target.value })} />
      </Field>
      <Field label="Client-safe name or pseudonym">
        <input type="text" className={inputCls} value={block.pseudonym ?? ''} onChange={(e) => onUpdate({ pseudonym: e.target.value || undefined })} />
      </Field>
      <Field label="Image URL (optional)">
        <input type="url" className={inputCls} value={block.imageUrl ?? ''} onChange={(e) => onUpdate({ imageUrl: e.target.value || undefined })} />
      </Field>
      <Field label="Impact Outcome">
        <textarea className={inputCls} rows={3} value={block.outcome} onChange={(e) => onUpdate({ outcome: e.target.value })} />
      </Field>
      <Field label="CTA Label">
        <input type="text" className={inputCls} value={block.ctaLabel ?? ''} onChange={(e) => onUpdate({ ctaLabel: e.target.value || undefined })} />
      </Field>
      <Field label="CTA URL">
        <input type="url" className={inputCls} value={block.ctaUrl ?? ''} onChange={(e) => onUpdate({ ctaUrl: e.target.value || undefined })} />
      </Field>
    </>
  );
}

function DonorThankYouEditor({
  block,
  onUpdate,
}: {
  block: DonorThankYouBlock;
  onUpdate: (partial: Partial<DonorThankYouBlock>) => void;
}) {
  return (
    <>
      <Field label="Thank-you Headline">
        <input type="text" className={inputCls} value={block.headline} onChange={(e) => onUpdate({ headline: e.target.value })} />
      </Field>
      <Field label="Gift Amount Merge Field">
        <input type="text" className={inputCls} value={block.giftAmountToken} onChange={(e) => onUpdate({ giftAmountToken: e.target.value })} />
      </Field>
      <Field label="Gift Date Merge Field">
        <input type="text" className={inputCls} value={block.giftDateToken} onChange={(e) => onUpdate({ giftDateToken: e.target.value })} />
      </Field>
      <Field label="Campaign/Designation Merge Field">
        <input type="text" className={inputCls} value={block.campaignToken} onChange={(e) => onUpdate({ campaignToken: e.target.value })} />
      </Field>
      <Field label="Short Thank-you Message">
        <textarea className={inputCls} rows={4} value={block.thankYouMessage} onChange={(e) => onUpdate({ thankYouMessage: e.target.value })} />
      </Field>
      <Field label="Staff Signature">
        <input type="text" className={inputCls} value={block.staffSignature} onChange={(e) => onUpdate({ staffSignature: e.target.value })} />
      </Field>
    </>
  );
}

function DonationReceiptEditor({
  block,
  onUpdate,
}: {
  block: DonationReceiptBlock;
  onUpdate: (partial: Partial<DonationReceiptBlock>) => void;
}) {
  return (
    <>
      <Field label="Donor Name">
        <input type="text" className={inputCls} value={block.donorNameToken} onChange={(e) => onUpdate({ donorNameToken: e.target.value })} />
      </Field>
      <Field label="Gift Amount">
        <input type="text" className={inputCls} value={block.giftAmountToken} onChange={(e) => onUpdate({ giftAmountToken: e.target.value })} />
      </Field>
      <Field label="Gift Date">
        <input type="text" className={inputCls} value={block.giftDateToken} onChange={(e) => onUpdate({ giftDateToken: e.target.value })} />
      </Field>
      <Field label="Receipt Number">
        <input type="text" className={inputCls} value={block.receiptNumberToken} onChange={(e) => onUpdate({ receiptNumberToken: e.target.value })} />
      </Field>
      <Field label="Tax-Deductible Amount">
        <input type="text" className={inputCls} value={block.taxDeductibleToken} onChange={(e) => onUpdate({ taxDeductibleToken: e.target.value })} />
      </Field>
      <Field label="Designation/Fund">
        <input type="text" className={inputCls} value={block.designationToken} onChange={(e) => onUpdate({ designationToken: e.target.value })} />
      </Field>
      <Field label="Organization Tax ID">
        <input type="text" className={inputCls} value={block.organizationTaxIdToken} onChange={(e) => onUpdate({ organizationTaxIdToken: e.target.value })} />
      </Field>
      <Field label="Goods/Services Statement">
        <textarea className={inputCls} rows={3} value={block.goodsServicesStatement} onChange={(e) => onUpdate({ goodsServicesStatement: e.target.value })} />
      </Field>
    </>
  );
}

function GivingSummaryEditor({
  block,
  onUpdate,
}: {
  block: GivingSummaryBlock;
  onUpdate: (partial: Partial<GivingSummaryBlock>) => void;
}) {
  return (
    <>
      <Field label="Year Token"><input type="text" className={inputCls} value={block.yearToken} onChange={(e) => onUpdate({ yearToken: e.target.value })} /></Field>
      <Field label="Total Giving Token"><input type="text" className={inputCls} value={block.totalGivingToken} onChange={(e) => onUpdate({ totalGivingToken: e.target.value })} /></Field>
      <Field label="Number of Gifts Token"><input type="text" className={inputCls} value={block.giftCountToken} onChange={(e) => onUpdate({ giftCountToken: e.target.value })} /></Field>
      <Field label="First Gift Date Token"><input type="text" className={inputCls} value={block.firstGiftDateToken} onChange={(e) => onUpdate({ firstGiftDateToken: e.target.value })} /></Field>
      <Field label="Last Gift Date Token"><input type="text" className={inputCls} value={block.lastGiftDateToken} onChange={(e) => onUpdate({ lastGiftDateToken: e.target.value })} /></Field>
      <Field label="Campaigns Supported Token"><input type="text" className={inputCls} value={block.campaignsSupportedToken} onChange={(e) => onUpdate({ campaignsSupportedToken: e.target.value })} /></Field>
    </>
  );
}

function DonationCtaEditor({
  block,
  onUpdate,
}: {
  block: DonationCtaBlock;
  onUpdate: (partial: Partial<DonationCtaBlock>) => void;
}) {
  return (
    <>
      <Field label="Headline"><input type="text" className={inputCls} value={block.headline} onChange={(e) => onUpdate({ headline: e.target.value })} /></Field>
      <Field label="Appeal Text"><textarea className={inputCls} rows={4} value={block.appealText} onChange={(e) => onUpdate({ appealText: e.target.value })} /></Field>
      <Field label="Suggested Gift Buttons" hint="One amount per line">
        <textarea className={inputCls} rows={5} value={block.suggestedAmounts.join('\n')} onChange={(e) => onUpdate({ suggestedAmounts: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8) })} />
      </Field>
      <Field label="Button Text"><input type="text" className={inputCls} value={block.buttonLabel} onChange={(e) => onUpdate({ buttonLabel: e.target.value })} /></Field>
      <Field label="Button URL"><input type="url" className={inputCls} value={block.buttonUrl} onChange={(e) => onUpdate({ buttonUrl: e.target.value })} /></Field>
    </>
  );
}

function MonthlyDonorInvitationEditor({
  block,
  onUpdate,
}: {
  block: MonthlyDonorInvitationBlock;
  onUpdate: (partial: Partial<MonthlyDonorInvitationBlock>) => void;
}) {
  return (
    <>
      <Field label="Headline"><input type="text" className={inputCls} value={block.headline} onChange={(e) => onUpdate({ headline: e.target.value })} /></Field>
      <Field label="Invitation Message"><textarea className={inputCls} rows={4} value={block.message} onChange={(e) => onUpdate({ message: e.target.value })} /></Field>
      <Field label="Suggested Monthly Amounts" hint="One amount per line">
        <textarea className={inputCls} rows={4} value={block.suggestedMonthlyAmounts.join('\n')} onChange={(e) => onUpdate({ suggestedMonthlyAmounts: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8) })} />
      </Field>
      <Field label="Benefit Bullets" hint="One bullet per line">
        <textarea className={inputCls} rows={4} value={block.benefitBullets.join('\n')} onChange={(e) => onUpdate({ benefitBullets: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8) })} />
      </Field>
      <Field label="CTA Label"><input type="text" className={inputCls} value={block.ctaLabel} onChange={(e) => onUpdate({ ctaLabel: e.target.value })} /></Field>
      <Field label="CTA URL"><input type="url" className={inputCls} value={block.ctaUrl} onChange={(e) => onUpdate({ ctaUrl: e.target.value })} /></Field>
    </>
  );
}

function LapsedDonorReengagementEditor({
  block,
  onUpdate,
}: {
  block: LapsedDonorReengagementBlock;
  onUpdate: (partial: Partial<LapsedDonorReengagementBlock>) => void;
}) {
  return (
    <>
      <Field label="Warm Greeting"><input type="text" className={inputCls} value={block.greeting} onChange={(e) => onUpdate({ greeting: e.target.value })} /></Field>
      <Field label="Last Gift Date Merge Field"><input type="text" className={inputCls} value={block.lastGiftDateToken} onChange={(e) => onUpdate({ lastGiftDateToken: e.target.value })} /></Field>
      <Field label="Re-Engagement Message"><textarea className={inputCls} rows={4} value={block.message} onChange={(e) => onUpdate({ message: e.target.value })} /></Field>
      <Field label="Impact Reminder"><textarea className={inputCls} rows={3} value={block.impactReminder} onChange={(e) => onUpdate({ impactReminder: e.target.value })} /></Field>
      <Field label="CTA Label"><input type="text" className={inputCls} value={block.ctaLabel} onChange={(e) => onUpdate({ ctaLabel: e.target.value })} /></Field>
      <Field label="CTA URL"><input type="url" className={inputCls} value={block.ctaUrl} onChange={(e) => onUpdate({ ctaUrl: e.target.value })} /></Field>
    </>
  );
}

function FirstTimeDonorWelcomeEditor({
  block,
  onUpdate,
}: {
  block: FirstTimeDonorWelcomeBlock;
  onUpdate: (partial: Partial<FirstTimeDonorWelcomeBlock>) => void;
}) {
  return (
    <>
      <Field label="Welcome Headline"><input type="text" className={inputCls} value={block.headline} onChange={(e) => onUpdate({ headline: e.target.value })} /></Field>
      <Field label="Mission Introduction"><textarea className={inputCls} rows={3} value={block.missionIntro} onChange={(e) => onUpdate({ missionIntro: e.target.value })} /></Field>
      <Field label="What To Expect Next"><textarea className={inputCls} rows={3} value={block.whatToExpect} onChange={(e) => onUpdate({ whatToExpect: e.target.value })} /></Field>
      <Field label="Contact Person"><input type="text" className={inputCls} value={block.contactPerson} onChange={(e) => onUpdate({ contactPerson: e.target.value })} /></Field>
      <Field label="CTA Label"><input type="text" className={inputCls} value={block.ctaLabel} onChange={(e) => onUpdate({ ctaLabel: e.target.value })} /></Field>
      <Field label="CTA URL"><input type="url" className={inputCls} value={block.ctaUrl} onChange={(e) => onUpdate({ ctaUrl: e.target.value })} /></Field>
    </>
  );
}

function StaffSignatureEditor({
  block,
  onUpdate,
}: {
  block: StaffSignatureBlock;
  onUpdate: (partial: Partial<StaffSignatureBlock>) => void;
}) {
  return (
    <>
      <Field label="Name Token"><input type="text" className={inputCls} value={block.nameToken} onChange={(e) => onUpdate({ nameToken: e.target.value })} /></Field>
      <Field label="Title Token"><input type="text" className={inputCls} value={block.titleToken} onChange={(e) => onUpdate({ titleToken: e.target.value })} /></Field>
      <Field label="Phone Token"><input type="text" className={inputCls} value={block.phoneToken} onChange={(e) => onUpdate({ phoneToken: e.target.value })} /></Field>
      <Field label="Email Token"><input type="text" className={inputCls} value={block.emailToken} onChange={(e) => onUpdate({ emailToken: e.target.value })} /></Field>
      <Field label="Organization Token"><input type="text" className={inputCls} value={block.organizationToken} onChange={(e) => onUpdate({ organizationToken: e.target.value })} /></Field>
      <Field label="Signature Image URL"><input type="url" className={inputCls} value={block.signatureImageUrl ?? ''} onChange={(e) => onUpdate({ signatureImageUrl: e.target.value || undefined })} /></Field>
      <Field label="Headshot URL"><input type="url" className={inputCls} value={block.headshotUrl ?? ''} onChange={(e) => onUpdate({ headshotUrl: e.target.value || undefined })} /></Field>
    </>
  );
}

function FooterComplianceEditor({
  block,
  onUpdate,
}: {
  block: FooterComplianceBlock;
  onUpdate: (partial: Partial<FooterComplianceBlock>) => void;
}) {
  return (
    <>
      <Field label="Organization Name"><input type="text" className={inputCls} value={block.organizationNameToken} onChange={(e) => onUpdate({ organizationNameToken: e.target.value })} /></Field>
      <Field label="Address"><input type="text" className={inputCls} value={block.addressToken} onChange={(e) => onUpdate({ addressToken: e.target.value })} /></Field>
      <Field label="Phone"><input type="text" className={inputCls} value={block.phoneToken} onChange={(e) => onUpdate({ phoneToken: e.target.value })} /></Field>
      <Field label="Website"><input type="text" className={inputCls} value={block.websiteToken} onChange={(e) => onUpdate({ websiteToken: e.target.value })} /></Field>
      <Field label="Unsubscribe Link"><input type="text" className={inputCls} value={block.unsubscribeToken} onChange={(e) => onUpdate({ unsubscribeToken: e.target.value })} /></Field>
      <Field label="Manage Preferences Link"><input type="text" className={inputCls} value={block.managePreferencesToken} onChange={(e) => onUpdate({ managePreferencesToken: e.target.value })} /></Field>
      <Field label="Tax ID (optional)"><input type="text" className={inputCls} value={block.taxIdToken ?? ''} onChange={(e) => onUpdate({ taxIdToken: e.target.value || undefined })} /></Field>
    </>
  );
}

function ImageEditor({
  block,
  onUpdate,
  onUploadImage,
  imageUploadInProgress,
  organizationLogoUrl,
  organizationDisplayName,
}: {
  block: ImageBlock;
  onUpdate: (partial: Partial<ImageBlock>) => void;
  onUploadImage?: (file: File) => Promise<string>;
  imageUploadInProgress?: boolean;
  organizationLogoUrl?: string;
  organizationDisplayName?: string;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadImage) return;

    setUploadError(null);
    try {
      const uploadedUrl = await onUploadImage(file);
      onUpdate({
        src: uploadedUrl,
        alt: block.alt.trim() ? block.alt : file.name,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <>
      {onUploadImage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleImageFilePicked(event);
            }}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(imageUploadInProgress)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {imageUploadInProgress ? 'Uploading image...' : 'Upload Image'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!organizationLogoUrl?.trim()) {
                  setUploadError('No organization logo found. Set it in Branding Settings first.');
                  return;
                }
                setUploadError(null);
                onUpdate({
                  src: organizationLogoUrl,
                  alt: `${organizationDisplayName || 'Organization'} logo`,
                });
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Use Organization Logo
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </>
      )}

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
  templateFontFamily,
}: {
  block: AiTextBlock;
  onUpdate: (partial: Partial<AiTextBlock>) => void;
  onGenerate?: () => void;
  generating: boolean;
  templateFontFamily?: string;
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
      <Field label="Generated Content">
        <RichTextEditor
          value={block.content}
          onChange={(content) => onUpdate({ content })}
          fontFamily={templateFontFamily}
          htmlEnabled={!!block.htmlEditingEnabled}
          onToggleHtmlEnabled={(enabled) => onUpdate({ htmlEditingEnabled: enabled })}
          htmlLabel="Enable raw HTML editor for this AI block"
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
  'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok',
];

const DEFAULT_SOCIAL_URLS: Record<SocialPlatform, string> = {
  facebook: 'https://facebook.com',
  twitter: 'https://x.com',
  instagram: 'https://instagram.com',
  linkedin: 'https://linkedin.com/company/',
  youtube: 'https://youtube.com/@',
  tiktok: 'https://tiktok.com/@',
};

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
      onUpdate({ links: [...block.links, { platform, url: DEFAULT_SOCIAL_URLS[platform] }] });
    } else {
      onUpdate({ links: block.links.filter((l) => l.platform !== platform) });
    }
  };

  return (
    <>
      <Field label="Section Title">
        <input
          type="text"
          className={inputCls}
          placeholder="Stay connected"
          value={block.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </Field>
      <Field label="Intro Text">
        <textarea
          className={`${inputCls} min-h-[84px] resize-y`}
          placeholder="Invite donors to follow your updates and campaign milestones."
          value={block.intro ?? ''}
          onChange={(e) => onUpdate({ intro: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Style Preset">
          <select
            className={selectCls}
            value={block.variant ?? 'card'}
            onChange={(e) => onUpdate({ variant: e.target.value as SocialBlock['variant'] })}
          >
            <option value="card">Card Grid</option>
            <option value="pill">Premium Pills</option>
            <option value="minimal">Minimal Icons</option>
          </select>
        </Field>
        <Field label="Color Mode">
          <select
            className={selectCls}
            value={block.colorMode ?? 'brand'}
            onChange={(e) => onUpdate({ colorMode: e.target.value as SocialBlock['colorMode'] })}
          >
            <option value="brand">Platform Brand</option>
            <option value="accent">Campaign Accent</option>
            <option value="neutral">Neutral Surface</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Accent Color">
          <div className="flex gap-2">
            <input
              type="color"
              className="h-9 w-11 rounded border border-slate-200 cursor-pointer p-0.5"
              value={block.accentColor ?? '#2563ff'}
              onChange={(e) => onUpdate({ accentColor: e.target.value })}
            />
            <input
              type="text"
              className={`${inputCls} flex-1`}
              value={block.accentColor ?? '#2563ff'}
              onChange={(e) => onUpdate({ accentColor: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Text Color">
          <div className="flex gap-2">
            <input
              type="color"
              className="h-9 w-11 rounded border border-slate-200 cursor-pointer p-0.5"
              value={block.textColor ?? '#0f172a'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
            />
            <input
              type="text"
              className={`${inputCls} flex-1`}
              value={block.textColor ?? '#0f172a'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Surface Color">
          <div className="flex gap-2">
            <input
              type="color"
              className="h-9 w-11 rounded border border-slate-200 cursor-pointer p-0.5"
              value={block.backgroundColor ?? '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
            <input
              type="text"
              className={`${inputCls} flex-1`}
              value={block.backgroundColor ?? '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Border Color">
          <div className="flex gap-2">
            <input
              type="color"
              className="h-9 w-11 rounded border border-slate-200 cursor-pointer p-0.5"
              value={block.borderColor ?? '#e6e9f2'}
              onChange={(e) => onUpdate({ borderColor: e.target.value })}
            />
            <input
              type="text"
              className={`${inputCls} flex-1`}
              value={block.borderColor ?? '#e6e9f2'}
              onChange={(e) => onUpdate({ borderColor: e.target.value })}
            />
          </div>
        </Field>
      </div>
      <Field label="Platforms">
        <div className="space-y-2">
          {ALL_PLATFORMS.map((platform) => {
            const link = block.links.find((l) => l.platform === platform);
            return (
              <div key={platform} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`social-${platform}`}
                    checked={!!link}
                    className="accent-blue-600"
                    onChange={(e) => togglePlatform(platform, e.target.checked)}
                  />
                  <label
                    htmlFor={`social-${platform}`}
                    className="text-sm font-semibold text-slate-700 capitalize"
                  >
                    {platform}
                  </label>
                </div>
                {link ? (
                  <input
                    type="url"
                    className={`${inputCls} mt-2`}
                    placeholder={`${DEFAULT_SOCIAL_URLS[platform]}...`}
                    value={link.url}
                    onChange={(e) => updateLink(platform, e.target.value)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </Field>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={block.showLabels !== false}
          className="accent-blue-600"
          onChange={(e) => onUpdate({ showLabels: e.target.checked })}
        />
        <span className="font-medium">Show platform labels</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
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
  const totalColumns = block.columnCount === 3 ? 3 : 2;

  const normalizeColumns = useCallback((targetCount: 2 | 3): EmailBlock[][] => {
    const nextColumns = Array.from({ length: targetCount }, (_, index) => block.columns[index] ?? []);
    return nextColumns.map((column, index) => {
      if (column.length > 0) return column;
      return [{
        id: crypto.randomUUID(),
        type: 'text',
        content: `<p>Column ${index + 1} text</p>`,
        fontSize: 14,
        color: '#333333',
        align: 'left',
        padding: 8,
      }];
    });
  }, [block.columns]);

  const updateColText = (colIndex: number, html: string) => {
    const cols = normalizeColumns(totalColumns as 2 | 3).map((col, i) => {
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

  const normalizedColumns = normalizeColumns(totalColumns as 2 | 3);

  return (
    <>
      <Field label="Grid Columns">
        <select
          className={selectCls}
          value={totalColumns}
          onChange={(event) => {
            const nextCount = event.target.value === '3' ? 3 : 2;
            onUpdate({
              columnCount: nextCount,
              columns: normalizeColumns(nextCount),
            });
          }}
        >
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
        </select>
      </Field>

      {normalizedColumns.map((column, index) => {
        const columnText = column[0]?.type === 'text' ? (column[0] as TextBlock).content : '';
        return (
          <Field key={`columns-editor-${index + 1}`} label={`Column ${index + 1} (HTML)`}>
            <textarea
              className={`${inputCls} font-mono text-xs`}
              rows={4}
              value={columnText}
              onChange={(e) => updateColText(index, e.target.value)}
            />
          </Field>
        );
      })}

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
  'Inter, Arial, Helvetica, sans-serif',
  'Segoe UI, Arial, Helvetica, sans-serif',
  'Helvetica Neue, Arial, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, \'Times New Roman\', serif',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, sans-serif',
  '\'Courier New\', monospace',
];

interface TemplateSettingsProps {
  template: EmailTemplate;
  activeTab: InspectorTab;
  onUpdateTemplate: (partial: Partial<EmailTemplate>) => void;
}

/** Shown in the right panel when no block is selected. */
function TemplateSettings({ template, activeTab, onUpdateTemplate }: TemplateSettingsProps) {
  if (activeTab === 'content') {
    return (
      <EmptyInspectorState
        title="Select a block to edit content"
        body="Choose any block on the canvas to update its copy. Template-wide style and layout controls are available in the Style and Settings tabs."
      />
    );
  }

  return (
    <div className="space-y-4">
      {activeTab === 'style' ? (
        <EmailWideStylePanel template={template} onUpdateTemplate={onUpdateTemplate} />
      ) : (
        <EmailWideSettingsPanel template={template} onUpdateTemplate={onUpdateTemplate} />
      )}
    </div>
  );
}

// ─── BlockEditor ──────────────────────────────────────────────────────────────

interface Props {
  selectedBlock:    EmailBlock | null;
  template:         EmailTemplate;
  onUpdateBlock:    (id: string, partial: Partial<EmailBlock>) => void;
  onUpdateTemplate: (partial: Partial<EmailTemplate>) => void;
  onUploadImage?: (file: File) => Promise<string>;
  imageUploadInProgress?: boolean;
  organizationLogoUrl?: string;
  organizationDisplayName?: string;
  onGenerateAiBlock?: (id: string) => void;
  aiGeneratingBlockId?: string | null;
  embedded?: boolean;
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
  onUploadImage,
  imageUploadInProgress,
  organizationLogoUrl,
  organizationDisplayName,
  onGenerateAiBlock,
  aiGeneratingBlockId,
  embedded = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('content');

  /* Stable update helper so child editors don't need the block id. */
  const update = useCallback(
    (partial: Partial<EmailBlock>) => {
      if (selectedBlock) onUpdateBlock(selectedBlock.id, partial);
    },
    [selectedBlock, onUpdateBlock]
  );

  const content = (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="mb-3 flex gap-6 border-b border-slate-200 pb-2 text-sm font-semibold">
          {([
            ['content', 'Content'],
            ['style', 'Style'],
            ['settings', 'Settings'],
          ] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={[
                'pb-2 transition-colors',
                activeTab === tabKey
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {selectedBlock
            ? `Edit: ${selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)}`
            : 'Properties'}
        </h2>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
        {!selectedBlock ? (
          <TemplateSettings
            template={template}
            activeTab={activeTab}
            onUpdateTemplate={onUpdateTemplate}
          />
        ) : activeTab === 'content' ? (
          <>
            {selectedBlock.type === 'text' && (
              <TextEditor
                block={selectedBlock as TextBlock}
                templateFontFamily={template.fontFamily}
                onUpdate={update as (p: Partial<TextBlock>) => void}
              />
            )}
            {selectedBlock.type === 'heading' && (
              <HeadingEditor
                block={selectedBlock as HeadingBlock}
                onUpdate={update as (p: Partial<HeadingBlock>) => void}
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
            {selectedBlock.type === 'impactStory' && (
              <ImpactStoryEditor
                block={selectedBlock as ImpactStoryBlock}
                onUpdate={update as (p: Partial<ImpactStoryBlock>) => void}
              />
            )}
            {selectedBlock.type === 'impactGrid' && (
              <ImpactGridEditor
                block={selectedBlock as ImpactGridBlock}
                onUpdate={update as (p: Partial<ImpactGridBlock>) => void}
              />
            )}
            {selectedBlock.type === 'progress' && (
              <ProgressEditor
                block={selectedBlock as ProgressBlock}
                onUpdate={update as (p: Partial<ProgressBlock>) => void}
              />
            )}
            {selectedBlock.type === 'timeline' && (
              <TimelineEditor
                block={selectedBlock as TimelineBlock}
                onUpdate={update as (p: Partial<TimelineBlock>) => void}
              />
            )}
            {selectedBlock.type === 'callout' && (
              <CalloutEditor
                block={selectedBlock as CalloutBlock}
                onUpdate={update as (p: Partial<CalloutBlock>) => void}
              />
            )}
            {selectedBlock.type === 'featureList' && (
              <FeatureListEditor
                block={selectedBlock as FeatureListBlock}
                onUpdate={update as (p: Partial<FeatureListBlock>) => void}
              />
            )}
            {selectedBlock.type === 'donorThankYou' && (
              <DonorThankYouEditor
                block={selectedBlock as DonorThankYouBlock}
                onUpdate={update as (p: Partial<DonorThankYouBlock>) => void}
              />
            )}
            {selectedBlock.type === 'donationReceipt' && (
              <DonationReceiptEditor
                block={selectedBlock as DonationReceiptBlock}
                onUpdate={update as (p: Partial<DonationReceiptBlock>) => void}
              />
            )}
            {selectedBlock.type === 'givingSummary' && (
              <GivingSummaryEditor
                block={selectedBlock as GivingSummaryBlock}
                onUpdate={update as (p: Partial<GivingSummaryBlock>) => void}
              />
            )}
            {selectedBlock.type === 'donationCta' && (
              <DonationCtaEditor
                block={selectedBlock as DonationCtaBlock}
                onUpdate={update as (p: Partial<DonationCtaBlock>) => void}
              />
            )}
            {selectedBlock.type === 'monthlyDonorInvitation' && (
              <MonthlyDonorInvitationEditor
                block={selectedBlock as MonthlyDonorInvitationBlock}
                onUpdate={update as (p: Partial<MonthlyDonorInvitationBlock>) => void}
              />
            )}
            {selectedBlock.type === 'lapsedDonorReengagement' && (
              <LapsedDonorReengagementEditor
                block={selectedBlock as LapsedDonorReengagementBlock}
                onUpdate={update as (p: Partial<LapsedDonorReengagementBlock>) => void}
              />
            )}
            {selectedBlock.type === 'firstTimeDonorWelcome' && (
              <FirstTimeDonorWelcomeEditor
                block={selectedBlock as FirstTimeDonorWelcomeBlock}
                onUpdate={update as (p: Partial<FirstTimeDonorWelcomeBlock>) => void}
              />
            )}
            {selectedBlock.type === 'staffSignature' && (
              <StaffSignatureEditor
                block={selectedBlock as StaffSignatureBlock}
                onUpdate={update as (p: Partial<StaffSignatureBlock>) => void}
              />
            )}
            {selectedBlock.type === 'footerCompliance' && (
              <FooterComplianceEditor
                block={selectedBlock as FooterComplianceBlock}
                onUpdate={update as (p: Partial<FooterComplianceBlock>) => void}
              />
            )}
            {selectedBlock.type === 'image' && (
              <ImageEditor
                block={selectedBlock as ImageBlock}
                onUpdate={update as (p: Partial<ImageBlock>) => void}
                onUploadImage={onUploadImage}
                imageUploadInProgress={imageUploadInProgress}
                organizationLogoUrl={organizationLogoUrl}
                organizationDisplayName={organizationDisplayName}
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
                templateFontFamily={template.fontFamily}
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
            {selectedBlock.type === 'customHtml' && (
              <CustomHtmlEditor
                block={selectedBlock as CustomHtmlBlock}
                onUpdate={update as (p: Partial<CustomHtmlBlock>) => void}
              />
            )}
          </>
        ) : activeTab === 'style' ? (
          <>
            <BlockStyleQuickPanel block={selectedBlock} onUpdate={update} />
            <EmailWideStylePanel template={template} onUpdateTemplate={onUpdateTemplate} />
          </>
        ) : (
          <>
            <BlockSettingsQuickPanel block={selectedBlock} onUpdate={update} />
            <EmailWideSettingsPanel template={template} onUpdateTemplate={onUpdateTemplate} />
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full flex-col overflow-hidden">{content}</div>;
  }

  return (
    <aside className="w-[300px] shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {content}
    </aside>
  );
}
