/** Merge field catalog, production settings, and activity rail. */
"use client";

import { useMemo, useState } from "react";
import type { GeneratedLetterSummary } from "@/app/components/letters/types";
import type { MergeFieldSection, RightPanelTab, SinglePreview } from "./letters-generation-types";

interface MergeSettingsPanelProps {
  tab: RightPanelTab;
  mergeSections: MergeFieldSection[];
  preview: SinglePreview | null;
  generatedLetters: GeneratedLetterSummary[];
  pageSize: string;
  orientation: string;
  marginPreset: string;
  dateFormat: string;
  currencyFormat: string;
  addressFormat: string;
  showOrganizationFooter: boolean;
  includeCoverPage: boolean;
  includeToc: boolean;
  pageNumbering: boolean;
  onTabChange: (tab: RightPanelTab) => void;
  onInsertMergeField: (field: string) => void;
  onMarginPresetChange: (value: string) => void;
  onDateFormatChange: (value: string) => void;
  onCurrencyFormatChange: (value: string) => void;
  onAddressFormatChange: (value: string) => void;
  onShowOrganizationFooterChange: (value: boolean) => void;
  onIncludeCoverPageChange: (value: boolean) => void;
  onIncludeTocChange: (value: boolean) => void;
  onPageNumberingChange: (value: boolean) => void;
}

/** Renders the right-side tabbed inspector for merge fields and output settings. */
export default function MergeSettingsPanel(props: MergeSettingsPanelProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-5 border-b border-slate-200 text-[11px] font-semibold">
        <TabButton active={props.tab === "merge-fields"} label="Merge Fields" onClick={() => props.onTabChange("merge-fields")} />
        <TabButton active={props.tab === "document-settings"} label="Document Settings" onClick={() => props.onTabChange("document-settings")} />
        <TabButton active={props.tab === "pdf-settings"} label="PDF Settings" onClick={() => props.onTabChange("pdf-settings")} />
        <TabButton active={props.tab === "validation"} label="Validation" onClick={() => props.onTabChange("validation")} />
        <TabButton active={props.tab === "activity"} label="Activity" onClick={() => props.onTabChange("activity")} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {props.tab === "merge-fields" ? <MergeFieldsTab {...props} /> : null}
        {props.tab === "document-settings" ? <DocumentSettingsTab {...props} /> : null}
        {props.tab === "pdf-settings" ? <PdfSettingsTab {...props} /> : null}
        {props.tab === "validation" ? <ValidationTab preview={props.preview} /> : null}
        {props.tab === "activity" ? <ActivityTab generatedLetters={props.generatedLetters} /> : null}
      </div>
    </aside>
  );
}

function MergeFieldsTab({ mergeSections, preview, onInsertMergeField }: MergeSettingsPanelProps) {
  const visibleSections = useMemo(() => mergeSections.filter((section) => section.fields.length > 0), [mergeSections]);
  const [activeKey, setActiveKey] = useState(visibleSections[0]?.key ?? "");
  const activeSection = visibleSections.find((section) => section.key === activeKey) ?? visibleSections[0];

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Search merge fields</span>
        <input placeholder="Search merge fields..." className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
      </label>
      {visibleSections.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No merge field catalog was returned for this user.</p> : null}
      {activeSection ? (
        <div className="grid min-h-[430px] grid-cols-[94px_minmax(0,1fr)] overflow-hidden rounded-lg border border-slate-200">
          <nav className="space-y-1 border-r border-slate-200 bg-slate-50 p-2">
            {visibleSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveKey(section.key)}
                className={`w-full rounded-md px-2 py-2 text-left text-xs font-semibold ${section.key === activeSection.key ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-white"}`}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 divide-y divide-slate-100 bg-white">
            {activeSection.fields.map((field) => {
              const key = field.slice(2, -2);
              const example = preview?.values?.[key] ?? preview?.values?.[aliasKey(key)] ?? "";
              return (
                <div key={field} className="grid grid-cols-[minmax(0,1fr)_64px] gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <code className="block truncate text-[12px] font-semibold text-slate-800">{field.replaceAll("{", "").replaceAll("}", "")}</code>
                    <p className="truncate text-xs text-slate-500">{example || describeField(key)}</p>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(field)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Copy">□</button>
                    <button type="button" onClick={() => onInsertMergeField(field)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Insert">▣</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-violet-100 bg-white p-3">
        <p className="text-xs font-semibold text-violet-700">Field Preview</p>
        <code className="mt-2 block text-xs font-semibold text-violet-700">{"{{ donation.amount }}"}</code>
        <p className="mt-2 text-sm text-slate-700">{preview?.values?.["donation.amount"] ?? preview?.values?.["gift.amount"] ?? "$100.00"}</p>
      </div>
    </div>
  );
}

function DocumentSettingsTab(props: MergeSettingsPanelProps) {
  return (
    <div className="space-y-3">
      <SettingReadout label="Page size" value={props.pageSize} />
      <SettingReadout label="Orientation" value={props.orientation} />
      <SelectControl label="Margins" value={props.marginPreset} onChange={props.onMarginPresetChange} options={["Normal", "Narrow", "Wide"]} />
      <SelectControl label="Date format" value={props.dateFormat} onChange={props.onDateFormatChange} options={["MMMM d, yyyy", "MM/dd/yyyy"]} />
      <SelectControl label="Currency format" value={props.currencyFormat} onChange={props.onCurrencyFormatChange} options={["$1,234.00", "USD 1,234.00"]} />
      <SelectControl label="Address block" value={props.addressFormat} onChange={props.onAddressFormatChange} options={["US multiline", "Compact"]} />
      <Toggle label="Show organization footer" checked={props.showOrganizationFooter} onChange={props.onShowOrganizationFooterChange} />
      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">Header, footer, logo, and signature presets are edited on the selected template. Server PDF currently uses the stored merged document and the existing PDF renderer.</p>
    </div>
  );
}

function PdfSettingsTab(props: MergeSettingsPanelProps) {
  return (
    <div className="space-y-3">
      <SettingReadout label="Paper size" value={props.pageSize} />
      <SettingReadout label="Scale" value="Fit printable width" />
      <SettingReadout label="Bleed" value="None" />
      <Toggle label="Page numbering" checked={props.pageNumbering} onChange={props.onPageNumberingChange} />
      <Toggle label="Include cover page" checked={props.includeCoverPage} onChange={props.onIncludeCoverPageChange} />
      <Toggle label="Include table of contents" checked={props.includeToc} onChange={props.onIncludeTocChange} />
      <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">PDF preview renders the generated PDF blob in the browser. PDF.js/react-pdf is not installed in this repo, so the workspace uses the browser PDF viewer for the actual binary preview.</p>
    </div>
  );
}

function ValidationTab({ preview }: { preview: SinglePreview | null }) {
  if (!preview) {
    return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Preview a real record to validate merge fields and PDF readiness.</p>;
  }
  const issues = [...preview.missingFields.map((field) => `Missing ${field}`), ...preview.unsupportedFields.map((field) => `Unsupported ${field}`)];
  if (issues.length === 0) {
    return <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Merge fields look good. No critical issues found.</div>;
  }
  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">{issue}</div>
      ))}
    </div>
  );
}

function ActivityTab({ generatedLetters }: { generatedLetters: GeneratedLetterSummary[] }) {
  const rows = generatedLetters.slice(0, 8);
  if (rows.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No generated document history yet for this workspace filter.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((letter) => (
        <div key={letter.id} className="rounded-md border border-slate-200 p-2">
          <p className="text-xs font-semibold text-slate-900">{letter.template?.name ?? "Generated document"}</p>
          <p className="text-xs text-slate-500">{letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "Batch or unlinked record"} · {letter.status}</p>
          <p className="mt-1 text-[11px] text-slate-400">{new Date(letter.generatedAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`min-w-0 border-r border-slate-200 px-1 py-3 text-[10px] ${active ? "border-b-2 border-b-emerald-500 bg-white text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>;
}

function SelectControl({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function SettingReadout({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 px-2 py-2"><p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p><p className="text-sm font-semibold text-slate-800">{value}</p></div>;
}

function aliasKey(key: string): string {
  if (key.startsWith("constituent.")) return key.replace("constituent.", "donor.");
  if (key.startsWith("donation.")) return key.replace("donation.designation", "gift.fund").replace("donation.", "gift.");
  return key;
}

function describeField(key: string): string {
  if (key.includes("amount")) return "Formatted giving amount from the selected donation context.";
  if (key.includes("date")) return "Formatted date from the selected record or year-end calculation.";
  if (key.includes("address")) return "Mailing address data from the constituent record.";
  if (key.startsWith("organization.")) return "Organization setting used in shared printable templates.";
  if (key.startsWith("staff.")) return "Current staff user context.";
  return "Merge value from the selected CRM record context.";
}
