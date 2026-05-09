/**
 * CustomFieldsManager — full CRUD UI for managing custom fields across entity types.
 * Displays built-in CRM fields (read-only reference) and allows admins/managers
 * to add, edit, and delete custom fields per entity type.
 *
 * Entity type tabs: Constituent | Donation | Campaign | Event
 * Each tab shows:
 *   - Built-in fields section (read-only, from fieldMap.ts)
 *   - Custom fields section (editable list with Add/Edit/Delete buttons)
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { CRM_CONSTITUENT_FIELDS, FIELD_GROUPS } from "@/app/data-tools/import/fieldMap";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Entity types that support custom fields. */
type EntityType = "constituent" | "donation" | "campaign" | "event";

/** A custom field definition returned from the API. */
interface CustomField {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string;
  key: string;
  fieldType: string;
  options: string | null;    // JSON-encoded string[]
  required: boolean;
  description: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Form state for the add/edit modal. */
interface FieldForm {
  name: string;
  key: string;
  fieldType: string;
  options: string;       // newline-separated option values
  required: boolean;
  description: string;
  placeholder: string;
  defaultValue: string;
  sortOrder: string;
}

const EMPTY_FORM: FieldForm = {
  name: "",
  key: "",
  fieldType: "text",
  options: "",
  required: false,
  description: "",
  placeholder: "",
  defaultValue: "",
  sortOrder: "0",
};

/** Supported field types with display labels. */
const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text",        label: "Short Text" },
  { value: "textarea",    label: "Long Text / Textarea" },
  { value: "number",      label: "Number" },
  { value: "boolean",     label: "Yes / No (Boolean)" },
  { value: "date",        label: "Date" },
  { value: "select",      label: "Dropdown (Select One)" },
  { value: "multiselect", label: "Multi-Select (Select Many)" },
  { value: "url",         label: "URL" },
  { value: "email",       label: "Email Address" },
  { value: "phone",       label: "Phone Number" },
];

/** Entity tab labels and descriptions. */
const ENTITY_TABS: { value: EntityType; label: string; desc: string }[] = [
  { value: "constituent", label: "Constituents", desc: "Fields on donor/contact profiles" },
  { value: "donation",    label: "Donations",    desc: "Fields on individual gift records" },
  { value: "campaign",    label: "Campaigns",    desc: "Fields on fundraising campaigns" },
  { value: "event",       label: "Events",       desc: "Fields on events and registrations" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a field name into a suggested camelCase key. */
function toFieldKey(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join("");
}

/** Colored badge for field type. */
function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text:        "bg-blue-50 text-blue-700",
    textarea:    "bg-blue-50 text-blue-700",
    number:      "bg-amber-50 text-amber-700",
    boolean:     "bg-purple-50 text-purple-700",
    date:        "bg-teal-50 text-teal-700",
    select:      "bg-indigo-50 text-indigo-700",
    multiselect: "bg-indigo-50 text-indigo-700",
    url:         "bg-gray-50 text-gray-700",
    email:       "bg-green-50 text-green-700",
    phone:       "bg-green-50 text-green-700",
  };
  const label = FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] ?? "bg-gray-100 text-gray-700"}`}>
      {label}
    </span>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface FieldModalProps {
  entityType: EntityType;
  initial?: CustomField | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Modal for creating or editing a custom field.
 * Auto-generates the key from the name when creating a new field.
 * Key is read-only when editing an existing field to protect existing values.
 */
function FieldModal({ entityType, initial, onClose, onSaved }: FieldModalProps) {
  const [form, setForm] = useState<FieldForm>(() => {
    if (!initial) return EMPTY_FORM;
    return {
      name:         initial.name,
      key:          initial.key,
      fieldType:    initial.fieldType,
      options:      initial.options ? (JSON.parse(initial.options) as string[]).join("\n") : "",
      required:     initial.required,
      description:  initial.description ?? "",
      placeholder:  initial.placeholder ?? "",
      defaultValue: initial.defaultValue ?? "",
      sortOrder:    String(initial.sortOrder),
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initial;
  const needsOptions = form.fieldType === "select" || form.fieldType === "multiselect";

  /** Auto-generate key from name when creating a new field. */
  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      // Only auto-generate key when creating; don't overwrite user-edited key
      key: isEditing ? f.key : toFieldKey(name),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.key.trim()) { setError("Key is required."); return; }
    if (!/^[a-z][a-zA-Z0-9]*$/.test(form.key)) { setError("Key must be camelCase (e.g. churchAffiliation)."); return; }
    if (needsOptions && !form.options.trim()) { setError("At least one option is required for select/multiselect fields."); return; }

    const options = needsOptions
      ? form.options.split("\n").map((o) => o.trim()).filter(Boolean)
      : undefined;

    setSaving(true);
    try {
      if (isEditing) {
        // Update: key and entityType cannot change
        await apiFetch(`/api/custom-fields/${initial!.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.trim(),
            options,
            required: form.required,
            description: form.description.trim() || null,
            placeholder: form.placeholder.trim() || null,
            defaultValue: form.defaultValue.trim() || null,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
          }),
        });
      } else {
        await apiFetch("/api/custom-fields", {
          method: "POST",
          body: JSON.stringify({
            entityType,
            name: form.name.trim(),
            key: form.key.trim(),
            fieldType: form.fieldType,
            options,
            required: form.required,
            description: form.description.trim() || null,
            placeholder: form.placeholder.trim() || null,
            defaultValue: form.defaultValue.trim() || null,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
          }),
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "Failed to save field.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Custom Field" : "Add Custom Field"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Church Affiliation"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Key <span className="text-red-500">*</span>
              {isEditing && <span className="ml-2 text-xs text-gray-400">(cannot change after creation)</span>}
            </label>
            <input
              type="text"
              value={form.key}
              onChange={(e) => !isEditing && setForm((f) => ({ ...f, key: e.target.value }))}
              readOnly={isEditing}
              placeholder="e.g. churchAffiliation"
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${isEditing ? "bg-gray-50 text-gray-500" : ""}`}
            />
            <p className="text-xs text-gray-400 mt-1">camelCase, used in API payloads. Auto-generated from name.</p>
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Type <span className="text-red-500">*</span>
              {isEditing && <span className="ml-2 text-xs text-gray-400">(cannot change after creation)</span>}
            </label>
            <select
              value={form.fieldType}
              onChange={(e) => !isEditing && setForm((f) => ({ ...f, fieldType: e.target.value }))}
              disabled={isEditing}
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isEditing ? "bg-gray-50 text-gray-500" : ""}`}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Options (only for select/multiselect) */}
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Options <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.options}
                onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                placeholder={"Option 1\nOption 2\nOption 3"}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">One option per line.</p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short help text shown below the field"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Placeholder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
            <input
              type="text"
              value={form.placeholder}
              onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))}
              placeholder="Input placeholder text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Default Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
            <input
              type="text"
              value={form.defaultValue}
              onChange={(e) => setForm((f) => ({ ...f, defaultValue: e.target.value }))}
              placeholder="Pre-filled value (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Options row: Required + sortOrder */}
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Required field
            </label>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-600">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * CustomFieldsManager — main page component.
 * Shows entity type tabs, built-in field reference, and a custom fields CRUD list.
 */
export default function CustomFieldsManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<EntityType>("constituent");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [builtInOpen, setBuiltInOpen] = useState(false);

  /** Determine if the user can write (manager or admin role). */
  const canWrite = user?.role === "admin" || user?.role === "manager";
  const canDelete = user?.role === "admin";

  /** Fetch custom fields for the active entity tab. */
  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/custom-fields?entityType=${activeTab}${showInactive ? "&includeInactive=true" : ""}`
      );
      setFields((res as { data: CustomField[] }).data ?? []);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, showInactive]);

  // Reload when tab or inactive toggle changes
  useEffect(() => { fetchFields(); }, [fetchFields]);

  /** Confirm and execute field deletion. */
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/custom-fields/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchFields();
    } catch {
      // Keep modal open on error
    } finally {
      setDeleting(false);
    }
  }

  /** Toggle field active/inactive without full delete. */
  async function handleToggleActive(field: CustomField) {
    try {
      await apiFetch(`/api/custom-fields/${field.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !field.active }),
      });
      fetchFields();
    } catch { /* ignore */ }
  }

  // Built-in fields for the active entity type (constituent only for now)
  const builtInFields = activeTab === "constituent" ? CRM_CONSTITUENT_FIELDS.filter((f) => f.group !== "Skip") : [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-sm text-gray-500 mt-1">
            Extend the CRM data model with organization-specific fields for any entity type.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <span className="text-lg leading-none">+</span>
            Add Custom Field
          </button>
        )}
      </div>

      {/* Entity type tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === tab.value
                ? "bg-white border border-b-white border-gray-200 text-green-700 -mb-px"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-sm text-gray-500 mb-5">
        {ENTITY_TABS.find((t) => t.value === activeTab)?.desc}
      </p>

      {/* ── Built-in Fields (collapsible reference) ── */}
      {builtInFields.length > 0 && (
        <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setBuiltInOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <span>📋 Built-in Fields ({builtInFields.length} fields)</span>
            <span className="text-gray-400">{builtInOpen ? "▲ Collapse" : "▼ Expand"}</span>
          </button>
          {builtInOpen && (
            <div className="divide-y divide-gray-100">
              {Object.entries(FIELD_GROUPS).map(([group, groupFields]) => (
                <div key={group}>
                  <p className="px-5 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50">
                    {group}
                  </p>
                  {groupFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-sm text-gray-800 font-medium w-48">{f.label}</span>
                      <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-1">{f.key}</code>
                      {f.required && (
                        <span className="text-xs text-red-600 font-medium">Required</span>
                      )}
                      {f.sensitive && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Sensitive</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Custom Fields List ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            Custom Fields
            {!loading && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({fields.filter((f) => f.active).length} active)
              </span>
            )}
          </h2>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-green-600"
            />
            Show inactive
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : fields.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">No custom fields yet for this entity type.</p>
            {canWrite && (
              <button
                onClick={() => { setEditTarget(null); setShowModal(true); }}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                + Add your first custom field
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-left font-medium">Key</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-left font-medium">Options</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                {canWrite && <th className="px-5 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.map((field) => (
                <tr key={field.id} className={`hover:bg-gray-50 ${!field.active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {field.name}
                    {field.required && <span className="ml-1 text-red-500 text-xs">*</span>}
                    {field.description && (
                      <p className="text-xs text-gray-400 font-normal mt-0.5">{field.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{field.key}</code>
                  </td>
                  <td className="px-5 py-3">
                    <TypeBadge type={field.fieldType} />
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {field.options
                      ? (JSON.parse(field.options) as string[]).join(", ")
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    {field.active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggleActive(field)}
                          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1"
                          title={field.active ? "Deactivate field" : "Activate field"}
                        >
                          {field.active ? "Disable" : "Enable"}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => { setEditTarget(field); setShowModal(true); }}
                          className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-2 py-1"
                        >
                          Edit
                        </button>
                        {/* Delete (admin only) */}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(field)}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <FieldModal
          entityType={activeTab}
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={() => { setShowModal(false); setEditTarget(null); fetchFields(); }}
        />
      )}

      {/* ── Delete Confirm Dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Custom Field?</h3>
            <p className="text-sm text-gray-600 mb-1">
              This will permanently delete <strong>{deleteTarget.name}</strong> ({deleteTarget.key}) and ALL stored values for this field across every {deleteTarget.entityType} record.
            </p>
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-5">
              ⚠️ This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, Delete Field"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
