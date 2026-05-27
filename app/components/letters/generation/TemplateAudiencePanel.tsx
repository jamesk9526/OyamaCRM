/** Template, audience, filters, and output controls for printable generation. */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type {
  CampaignLookup,
  ConstituentLookup,
  GenerateAudienceSource,
  LetterTemplateCard,
  PrintableDocumentType,
  SavedAudienceList,
  SinglePreview,
} from "./letters-generation-types";
import { formatConstituentName, printableTypeLabel } from "./generation-utils";

interface TemplateAudiencePanelProps {
  documentTypes: PrintableDocumentType[];
  documentTypeId: string;
  templates: LetterTemplateCard[];
  templateId: string;
  audienceSource: GenerateAudienceSource;
  constituentSearch: string;
  constituentOptions: ConstituentLookup[];
  selectedConstituent: ConstituentLookup | null;
  selectedContactIds: Set<string>;
  contactSearch: string;
  contactOptions: ConstituentLookup[];
  audienceLists: SavedAudienceList[];
  audienceListId: string;
  matchedListIds: string[];
  reportIds: string[];
  campaigns: CampaignLookup[];
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  segmentFilter: string;
  year: string;
  pageSize: string;
  orientation: string;
  dedupeHousehold: boolean;
  preview: SinglePreview | null;
  onDocumentTypeChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onAudienceSourceChange: (value: GenerateAudienceSource) => void;
  onConstituentSearchChange: (value: string) => void;
  onChooseConstituent: (row: ConstituentLookup) => void;
  onContactSearchChange: (value: string) => void;
  onToggleContact: (row: ConstituentLookup) => void;
  onAudienceListChange: (value: string) => void;
  onCampaignChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSegmentFilterChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onPageSizeChange: (value: string) => void;
  onOrientationChange: (value: string) => void;
  onDedupeHouseholdChange: (value: boolean) => void;
}

/** Renders the left configuration rail for the generation workspace. */
export default function TemplateAudiencePanel(props: TemplateAudiencePanelProps) {
  const selectedTemplate = props.templates.find((template) => template.id === props.templateId) ?? null;
  const missingCount = props.preview?.missingFields.length ?? 0;
  const unsupportedCount = props.preview?.unsupportedFields.length ?? 0;

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <PanelSection title="Document Type">
        <div className="grid gap-2">
          {props.documentTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => props.onDocumentTypeChange(type.id)}
              className={`rounded-lg border p-2 text-left ${props.documentTypeId === type.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span className="block text-sm font-semibold text-slate-900">{type.label}</span>
              <span className="block text-xs text-slate-500">{type.description}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Template">
        {props.templates.length === 0 ? (
          <EmptyText text="No real templates exist yet. Create a template before generating documents." />
        ) : (
          <div className="grid gap-2">
            {props.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => props.onTemplateChange(template.id)}
                className={`rounded-lg border p-2 text-left ${props.templateId === template.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{template.name}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{template.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{printableTypeLabel(template.category)} · Edited {new Date(template.updatedAt).toLocaleDateString()}</p>
                <p className="mt-1 text-xs text-slate-500">Created by {formatUser(template.createdBy)}</p>
              </button>
            ))}
          </div>
        )}
        {selectedTemplate ? <Link href={`/oyama-letters/templates/${selectedTemplate.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">Edit selected template</Link> : null}
      </PanelSection>

      <PanelSection title="Audience / Records">
        <select value={props.audienceSource} onChange={(event) => props.onAudienceSourceChange(event.target.value as GenerateAudienceSource)} className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm">
          <option value="single">Single constituent</option>
          <option value="multiple">Multiple selected constituents</option>
          <option value="saved-list">Saved list</option>
          <option value="report-result">Report result</option>
          <option value="campaign">Campaign donors</option>
          <option value="date-range">Date range donors</option>
          <option value="segment">Filtered donor segment</option>
        </select>
        <AudienceSelector {...props} />
      </PanelSection>

      <PanelSection title="Filters">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Year
            <input value={props.year} onChange={(event) => props.onYearChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="inline-flex items-end gap-2 pb-1 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={props.dedupeHousehold} onChange={(event) => props.onDedupeHouseholdChange(event.target.checked)} />
            Dedupe households
          </label>
        </div>
      </PanelSection>

      <PanelSection title="Merge Field Status">
        {!props.preview ? (
          <EmptyText text="Preview a real record to validate merge fields." />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <StatusMetric label="Missing" value={missingCount} tone={missingCount > 0 ? "warn" : "ok"} />
            <StatusMetric label="Unsupported" value={unsupportedCount} tone={unsupportedCount > 0 ? "warn" : "ok"} />
          </div>
        )}
      </PanelSection>

      <PanelSection title="Output Settings">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Page
            <select value={props.pageSize} onChange={(event) => props.onPageSizeChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option>Letter</option>
              <option>A4</option>
              <option>Custom</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Orientation
            <select value={props.orientation} onChange={(event) => props.onOrientationChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option>Portrait</option>
              <option>Landscape</option>
            </select>
          </label>
        </div>
      </PanelSection>
    </aside>
  );
}

function AudienceSelector(props: TemplateAudiencePanelProps) {
  if (props.audienceSource === "single") {
    return (
      <Lookup label="Constituent" value={props.constituentSearch} onChange={props.onConstituentSearchChange} placeholder="Search real constituents">
        {props.constituentOptions.map((row) => <LookupRow key={row.id} row={row} selected={props.selectedConstituent?.id === row.id} onClick={() => props.onChooseConstituent(row)} />)}
      </Lookup>
    );
  }

  if (props.audienceSource === "multiple") {
    return (
      <Lookup label="Select constituents" value={props.contactSearch} onChange={props.onContactSearchChange} placeholder="Search and add recipients">
        {props.contactOptions.map((row) => <LookupRow key={row.id} row={row} selected={props.selectedContactIds.has(row.id)} onClick={() => props.onToggleContact(row)} />)}
        <p className="px-2 py-1 text-xs text-slate-500">{props.selectedContactIds.size} selected.</p>
      </Lookup>
    );
  }

  if (props.audienceSource === "saved-list") {
    return (
      <div className="space-y-2">
        <select value={props.audienceListId} onChange={(event) => props.onAudienceListChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm">
          <option value="">Choose saved list</option>
          {props.audienceLists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipientsCount})</option>)}
        </select>
        <p className="text-xs text-slate-500">Matched {props.matchedListIds.length} saved-list emails to constituent records.</p>
      </div>
    );
  }

  if (props.audienceSource === "report-result") {
    return props.reportIds.length > 0 ? <p className="text-xs text-slate-600">{props.reportIds.length} constituent IDs loaded from report URL handoff.</p> : <EmptyText text="No report result is attached. Open OyamaLetters Generate Center from a report result to use this source." />;
  }

  if (props.audienceSource === "campaign") {
    return (
      <select value={props.campaignId} onChange={(event) => props.onCampaignChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm">
        <option value="">Choose campaign</option>
        {props.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} ({campaign._count?.donations ?? 0})</option>)}
      </select>
    );
  }

  if (props.audienceSource === "date-range") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={props.dateFrom} onChange={(event) => props.onDateFromChange(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <input type="date" value={props.dateTo} onChange={(event) => props.onDateToChange(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
    );
  }

  return (
    <select value={props.segmentFilter} onChange={(event) => props.onSegmentFilterChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm">
      <option value="ALL">All donors</option>
      <option value="ACTIVE">Active donors</option>
      <option value="LAPSED">Lapsed donors</option>
      <option value="NEW">New donors</option>
      <option value="MAJOR_DONOR">Major donors</option>
      <option value="MONTHLY_DONOR">Monthly donors</option>
    </select>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Lookup({ label, value, onChange, placeholder, children }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" />
      <div className="mt-1 max-h-44 overflow-auto rounded-md border border-slate-200 bg-white">{children}</div>
    </label>
  );
}

function LookupRow({ row, selected, onClick }: { row: ConstituentLookup; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`block w-full border-b border-slate-100 px-2 py-2 text-left text-xs hover:bg-slate-50 ${selected ? "bg-emerald-50" : ""}`}>
      <span className="block font-semibold text-slate-900">{formatConstituentName(row)}</span>
      <span className="block truncate text-slate-500">{row.email || row.phone || row.donorStatus || row.id}</span>
    </button>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{text}</p>;
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
      <p className="text-[10px] font-semibold uppercase">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function formatUser(user: LetterTemplateCard["createdBy"]): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || "Unknown";
}
