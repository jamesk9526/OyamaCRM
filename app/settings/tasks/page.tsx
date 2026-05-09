/**
 * Settings — Tasks page.
 * Displays and allows editing of default task configuration:
 * task categories, priority defaults, overdue handling, and auto-create rules.
 *
 * NOTE: UI-configured only. Backend persistence requires wiring to
 * PUT /api/settings with a "tasks" metadata namespace.
 * TODO: backend API needed for saving task defaults.
 */
"use client";

import { useState } from "react";

/** Task priority options */
const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-600" },
  { value: "MEDIUM", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "URGENT", label: "Urgent", color: "bg-red-100 text-red-700" },
];

/** Task status options */
const STATUSES = [
  { value: "PENDING", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING", label: "Waiting" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Canceled" },
];

/** Task category suggestions */
const CATEGORY_DEFAULTS = [
  "Donor Follow-Up",
  "Thank-You Call",
  "Meeting Prep",
  "Meeting Follow-Up",
  "Major Donor Cultivation",
  "Monthly Donor Invitation",
  "Pledge Follow-Up",
  "Event Follow-Up",
  "Sponsor Follow-Up",
  "Church Contact",
  "Board Follow-Up",
  "Admin Task",
  "Data Cleanup",
];

/** TasksSettingsPage — configure task defaults for the Donor CRM */
export default function TasksSettingsPage() {
  const [defaultPriority, setDefaultPriority] = useState("MEDIUM");
  const [defaultDueDays, setDefaultDueDays] = useState("3");
  const [overdueNotify, setOverdueNotify] = useState(true);
  const [overdueAfterDays, setOverdueAfterDays] = useState("1");
  const [categories, setCategories] = useState<string[]>(CATEGORY_DEFAULTS);
  const [newCategory, setNewCategory] = useState("");
  const [saved, setSaved] = useState(false);

  // TODO: backend API needed — wire to PUT /api/settings with tasks namespace
  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addCategory() {
    if (!newCategory.trim() || categories.includes(newCategory.trim())) return;
    setCategories([...categories, newCategory.trim()]);
    setNewCategory("");
  }

  function removeCategory(cat: string) {
    setCategories(categories.filter((c) => c !== cat));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Task Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure default task behavior, categories, priorities, and overdue handling.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          {saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>

      {/* Backend note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> These defaults are UI-configured. Backend persistence requires wiring to{" "}
        <code className="text-amber-700 bg-amber-100 px-1 rounded">PUT /api/settings</code>.
        {/* TODO: backend API needed */}
      </div>

      {/* Defaults */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Task Defaults</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Priority</label>
            <select
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Due Date</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(e.target.value)}
                className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <span className="text-sm text-gray-600">days from creation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Overdue handling */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Overdue Handling</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={overdueNotify}
            onChange={(e) => setOverdueNotify(e.target.checked)}
            className="w-4 h-4 accent-green-600"
          />
          <div>
            <div className="text-sm font-medium text-gray-700">Notify staff when tasks become overdue</div>
            <div className="text-xs text-gray-400">Staff are notified when an assigned task passes its due date.</div>
          </div>
        </label>

        {overdueNotify && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-gray-600">Notify after</span>
            <input
              type="number"
              min="0"
              max="7"
              value={overdueAfterDays}
              onChange={(e) => setOverdueAfterDays(e.target.value)}
              className="w-16 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <span className="text-sm text-gray-600">day(s) overdue</span>
          </div>
        )}
      </section>

      {/* Priority reference */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Priority Levels</h2>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <span key={p.value} className={`px-3 py-1 rounded-full text-sm font-medium ${p.color}`}>
              {p.label}
            </span>
          ))}
        </div>
      </section>

      {/* Status reference */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Task Statuses</h2>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <div key={s.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700">{s.label}</span>
              <code className="text-xs text-gray-400 ml-auto">{s.value}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Task Categories</h2>
        <p className="text-xs text-gray-500">Categories help staff organize tasks by workflow type.</p>

        {/* Add category */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="Add new category…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <button
            onClick={addCategory}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-medium rounded-lg hover:bg-green-100"
          >
            Add
          </button>
        </div>

        {/* Category list */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
            >
              {cat}
              <button
                onClick={() => removeCategory(cat)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                aria-label={`Remove ${cat}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
