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
import { formatConstituentName } from "./generation-utils";

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
  const selectedDocumentType = props.documentTypes.find((type) => type.id === props.documentTypeId) ?? props.documentTypes[0];
  const missingCount = props.preview?.missingFields.length ?? 0;
  const unsupportedCount = props.preview?.unsupportedFields.length ?? 0;
  const selectedCount = audienceCount(props);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-auto rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm">
      <StepCard step="STEP 1" title="Document Type" complete={Boolean(selectedDocumentType)}>
        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-700">◆</span>
          <select value={props.documentTypeId} onChange={(event) => props.onDocumentTypeChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
            {props.documentTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </label>
      </StepCard>

      <StepCard step="STEP 2" title="Template" complete={Boolean(selectedTemplate)}>
        {props.templates.length === 0 ? (
          <EmptyText text="No real templates exist yet. Create a template before generating documents." />
        ) : selectedTemplate ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">{selectedTemplate.name}</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{selectedTemplate.status}</span>
            </div>
            <div className="mt-3 flex gap-3">
              <div className="h-28 w-28 shrink-0 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                <div className="h-full rounded-sm border border-slate-100 bg-gradient-to-b from-white to-slate-50 px-2 py-2">
                  <div className="mb-2 h-2 w-10 rounded bg-violet-100" />
                  <div className="space-y-1">
                    {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-1 rounded bg-slate-200" />)}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 text-xs text-slate-600">
                <p>Last edited</p>
                <p className="font-semibold text-slate-800">{new Date(selectedTemplate.updatedAt).toLocaleDateString()}</p>
                <p className="mt-2">by {formatUser(selectedTemplate.createdBy)}</p>
              </div>
            </div>
            <select value={props.templateId} onChange={(event) => props.onTemplateChange(event.target.value)} className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              {props.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <div className="mt-2 flex justify-between gap-2">
              <Link href={`/oyama-letters/templates/${selectedTemplate.id}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit Template</Link>
              <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Change Template</button>
            </div>
          </div>
        ) : (
          <EmptyText text="Choose a real template before generating documents." />
        )}
      </StepCard>

      <StepCard step="STEP 3" title="Audience / Records" complete={selectedCount > 0 || props.audienceSource === "segment" || props.audienceSource === "campaign" || props.audienceSource === "date-range"}>
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
        {selectedCount > 0 ? (
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-xs">
            <p className="font-semibold text-emerald-700">{selectedCount} recipient{selectedCount === 1 ? "" : "s"} selected</p>
            <p className="mt-1 text-emerald-800">Merge check: {missingCount + unsupportedCount === 0 && props.preview ? "No critical issues found." : "Preview to inspect missing fields."}</p>
            {missingCount > 0 ? <p className="mt-1 text-amber-700">{missingCount} missing merge field{missingCount === 1 ? "" : "s"}</p> : null}
          </div>
        ) : null}
      </StepCard>

      <StepCard step="STEP 4" title="Output Settings" complete>
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
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Year
            <input value={props.year} onChange={(event) => props.onYearChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="inline-flex items-end gap-2 pb-1 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={props.dedupeHousehold} onChange={(event) => props.onDedupeHouseholdChange(event.target.checked)} />
            Dedupe
          </label>
        </div>
        <button type="button" className="mt-3 h-10 w-full rounded-md border border-violet-400 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100">⚙ Advanced Settings</button>
      </StepCard>
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

function StepCard({ step, title, complete, children }: { step: string; title: string; complete?: boolean; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{step}</span>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        {complete ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span> : null}
      </div>
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

function formatUser(user: LetterTemplateCard["createdBy"]): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || "Unknown";
}

function audienceCount(props: TemplateAudiencePanelProps): number {
  if (props.audienceSource === "single") return props.selectedConstituent ? 1 : 0;
  if (props.audienceSource === "multiple") return props.selectedContactIds.size;
  if (props.audienceSource === "saved-list") return props.matchedListIds.length;
  if (props.audienceSource === "report-result") return props.reportIds.length;
  return 0;
}
