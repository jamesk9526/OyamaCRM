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
      <Field label="Content">
        <RichTextEditor
          value={block.content}
          onChange={(content) => onUpdate({ content })}
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
      <Field label="Generated Content">
        <RichTextEditor
          value={block.content}
          onChange={(content) => onUpdate({ content })}
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
  onGenerateAiBlock,
  aiGeneratingBlockId,
  embedded = false,
}: Props) {
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
            {selectedBlock.type === 'customHtml' && (
              <CustomHtmlEditor
                block={selectedBlock as CustomHtmlBlock}
                onUpdate={update as (p: Partial<CustomHtmlBlock>) => void}
              />
            )}
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full flex-col overflow-hidden">{content}</div>;
  }

  return (
    <aside className="w-[300px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {content}
    </aside>
  );
}
