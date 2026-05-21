"use client";

import { useMemo, useState } from "react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

export type ReportStatus = "draft" | "active" | "archived";
export type ReportFrequency = "once" | "daily" | "weekly" | "monthly";

export interface EditableReportValues {
  name: string;
  template: string;
  owner: string;
  status: ReportStatus;
  frequency: ReportFrequency;
  time: string;
  recipientsText: string;
  emailOnCompletion: boolean;
}

interface Props {
  mode: "create" | "edit";
  initial?: EditableReportValues;
  onClose: () => void;
  onSave: (values: EditableReportValues) => void;
}

const TEMPLATE_OPTIONS = [
  { value: "donor-summary", label: "Donor Summary" },
  { value: "donor-retention", label: "Donor Retention" },
  { value: "year-to-date-giving", label: "Year-to-Date Giving" },
  { value: "campaign-performance", label: "Campaign Performance" },
];

const STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const FREQUENCY_OPTIONS: Array<{ value: ReportFrequency; label: string }> = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const EMPTY_VALUES: EditableReportValues = {
  name: "",
  template: "donor-summary",
  owner: "",
  status: "draft",
  frequency: "monthly",
  time: "09:00",
  recipientsText: "",
  emailOnCompletion: true,
};

/** Modal form used by Reports Manager for creating and editing saved reports. */
export default function ReportEditorModal({ mode, initial, onClose, onSave }: Props) {
  const [values, setValues] = useState<EditableReportValues>(initial ?? EMPTY_VALUES);

  const title = mode === "create" ? "New Report" : "Edit Report";
  const submitLabel = mode === "create" ? "Create Report" : "Save Changes";

  const isValid = useMemo(() => {
    return Boolean(values.name.trim() && values.owner.trim() && values.template.trim());
  }, [values]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    onSave({
      ...values,
      name: values.name.trim(),
      owner: values.owner.trim(),
      recipientsText: values.recipientsText.trim(),
    });
  }

  return (
    <WorkspaceSetupModal
      title={title}
      subtitle="Define report basics, owner, and optional schedule settings."
      checklist={[
        "1. Choose report details",
        "2. Set status and schedule",
        "3. Save changes",
      ]}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
    >
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Report Name *</label>
              <input
                type="text"
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Monthly Donor Summary"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Template *</label>
              <select
                value={values.template}
                onChange={(event) => setValues((prev) => ({ ...prev, template: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                {TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Owner *</label>
              <input
                type="text"
                value={values.owner}
                onChange={(event) => setValues((prev) => ({ ...prev, owner: event.target.value }))}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
              <select
                value={values.status}
                onChange={(event) => setValues((prev) => ({ ...prev, status: event.target.value as ReportStatus }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-800">Schedule (Optional)</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Frequency</label>
                <select
                  value={values.frequency}
                  onChange={(event) => setValues((prev) => ({ ...prev, frequency: event.target.value as ReportFrequency }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Time</label>
                <input
                  type="time"
                  value={values.time}
                  onChange={(event) => setValues((prev) => ({ ...prev, time: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Recipients</label>
              <textarea
                value={values.recipientsText}
                onChange={(event) => setValues((prev) => ({ ...prev, recipientsText: event.target.value }))}
                placeholder="director@org.com, development@org.com"
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">Separate multiple emails with commas.</p>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={values.emailOnCompletion}
                onChange={(event) => setValues((prev) => ({ ...prev, emailOnCompletion: event.target.checked }))}
                className="h-4 w-4 accent-green-600"
              />
              Email recipients when this report finishes
            </label>
          </section>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}
