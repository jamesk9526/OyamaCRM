/**
 * GrantWritingPanel — section-by-section grant writing workspace.
 * Shows all proposal sections with word count vs limit, completion toggle,
 * and a large textarea editor for each section's narrative content.
 *
 * Auto-saves on blur (Ctrl+S); displays overall completion progress.
 */
"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { GrantSection } from "./types";
import { wordCount } from "./types";

interface Props {
  grantId: string;
  sections: GrantSection[];
  onSectionsChange: (sections: GrantSection[]) => void;
}

/** Word count indicator: red if over limit, amber if near limit (>90%), green otherwise. */
function WordCountBadge({ count, limit }: { count: number; limit?: number | null }) {
  if (!limit) return <span className="text-xs text-gray-400">{count} words</span>;
  const pct = count / limit;
  const color = count > limit ? "text-red-600" : pct > 0.9 ? "text-amber-600" : "text-gray-400";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {count} / {limit} words
    </span>
  );
}

/** Completion progress ring (SVG). */
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="20" cy="20" r={r}
          fill="none"
          stroke={pct === 100 ? "#16a34a" : "#60a5fa"}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="600" fill="#374151">{pct}%</text>
      </svg>
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{completed}/{total}</span> sections complete
      </div>
    </div>
  );
}

/**
 * GrantWritingPanel — full grant writing workspace with per-section editors.
 * Sections are auto-seeded when the grant is created; content is saved via PATCH.
 */
export default function GrantWritingPanel({ grantId, sections, onSectionsChange }: Props) {
  // Which section is currently expanded for editing
  const [activeKey, setActiveKey] = useState<string | null>(sections[0]?.key ?? null);
  // Track unsaved changes per section key
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  /** Save a section's content and/or completion status to the API. */
  const saveSection = useCallback(async (key: string, patch: { content?: string; completed?: boolean }) => {
    setSaving(key);
    try {
      const updated: GrantSection = await apiFetch(`/api/grants/${grantId}/sections/${key}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onSectionsChange(sections.map((s) => s.key === key ? updated : s));
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
    } catch {
      // Silently fail — user will see the content is still in the textarea
    } finally {
      setSaving(null);
    }
  }, [grantId, sections, onSectionsChange]);

  /** Handle textarea blur: save if content has changed from what's in the section. */
  const handleBlur = useCallback((section: GrantSection) => {
    const draft = drafts[section.key];
    if (draft !== undefined && draft !== (section.content ?? "")) {
      saveSection(section.key, { content: draft });
    }
  }, [drafts, saveSection]);

  /** Toggle a section's completion status. */
  const toggleComplete = useCallback((section: GrantSection) => {
    saveSection(section.key, { completed: !section.completed });
  }, [saveSection]);

  const completedCount = sections.filter((s) => s.completed).length;
  const activeSection = sections.find((s) => s.key === activeKey);
  const activeDraft = activeKey ? (drafts[activeKey] ?? activeSection?.content ?? "") : "";
  const activeWords = wordCount(activeDraft);

  return (
    <div className="flex gap-0 h-full min-h-[600px]">
      {/* Left: Section list */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        {/* Progress summary */}
        <div className="p-4 border-b border-gray-200">
          <ProgressRing completed={completedCount} total={sections.length} />
        </div>

        {/* Section nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((s) => {
            const wc = wordCount(drafts[s.key] ?? s.content);
            const hasContent = wc > 0;
            return (
              <button
                key={s.key}
                onClick={() => setActiveKey(s.key)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-2 transition-colors ${
                  activeKey === s.key
                    ? "bg-white border-l-2 border-green-600 text-green-700"
                    : "hover:bg-white text-gray-600 border-l-2 border-transparent"
                }`}
              >
                {/* Completion indicator */}
                <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  s.completed ? "bg-green-500 border-green-500" : hasContent ? "border-blue-400" : "border-gray-300"
                }`}>
                  {s.completed && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug truncate">{s.title}</p>
                  {hasContent && !s.completed && (
                    <p className="text-[10px] text-blue-500 mt-0.5">{wc} words</p>
                  )}
                  {s.completed && (
                    <p className="text-[10px] text-green-600 mt-0.5">Complete</p>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 flex flex-col bg-white">
        {activeSection ? (
          <>
            {/* Editor header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{activeSection.title}</h3>
                <WordCountBadge count={activeWords} limit={activeSection.wordLimit} />
              </div>
              <div className="flex items-center gap-3">
                {saved[activeSection.key] && (
                  <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                )}
                {saving === activeSection.key && (
                  <span className="text-xs text-gray-400">Saving…</span>
                )}
                <button
                  onClick={() => toggleComplete(activeSection)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeSection.completed
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {activeSection.completed ? "✓ Mark Incomplete" : "Mark Complete"}
                </button>
                <button
                  onClick={() => {
                    const draft = drafts[activeSection.key];
                    if (draft !== undefined && draft !== (activeSection.content ?? "")) {
                      saveSection(activeSection.key, { content: draft });
                    }
                  }}
                  disabled={saving === activeSection.key}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Writing tips for this section */}
            <SectionTip sectionKey={activeSection.key} />

            {/* Main editor */}
            <textarea
              value={activeDraft}
              onChange={(e) => {
                setDrafts((p) => ({ ...p, [activeSection.key]: e.target.value }));
              }}
              onBlur={() => handleBlur(activeSection)}
              onKeyDown={(e) => {
                // Ctrl+S / Cmd+S to save
                if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                  e.preventDefault();
                  const draft = drafts[activeSection.key];
                  if (draft !== undefined) saveSection(activeSection.key, { content: draft });
                }
              }}
              placeholder={`Write your ${activeSection.title.toLowerCase()} here…`}
              className="flex-1 resize-none p-6 text-sm text-gray-800 leading-relaxed focus:outline-none"
              spellCheck
            />

            {/* Word count bar */}
            {activeSection.wordLimit && (
              <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      activeWords > activeSection.wordLimit ? "bg-red-500"
                        : activeWords / activeSection.wordLimit > 0.9 ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, (activeWords / activeSection.wordLimit) * 100)}%` }}
                  />
                </div>
                <WordCountBadge count={activeWords} limit={activeSection.wordLimit} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a section from the left to begin writing.
          </div>
        )}
      </div>
    </div>
  );
}

/** Writing tips shown below the section header based on section type. */
const TIPS: Record<string, string> = {
  executive_summary:  "Summarize the problem, your solution, and the impact. Write this last — it should be a distillation of the full proposal.",
  need_statement:     "Use local data and statistics to demonstrate the specific, documented need your program addresses in the community.",
  program_description:"Describe what you will do, how you will do it, who will deliver services, and the timeline for implementation.",
  goals_objectives:   "List 2–4 SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound) tied to measurable outcomes.",
  evaluation_plan:    "Explain how you will measure success. Include both process measures (activities) and outcome measures (impact on beneficiaries).",
  budget_narrative:   "Justify each line item, explain any in-kind contributions or matching funds, and link expenses to program activities.",
  org_background:     "Briefly describe your organization's history, mission, credentials, and track record delivering similar programs.",
  sustainability_plan:"Explain how the program will continue after the grant period ends — through earned revenue, other funders, or integration into operations.",
  loi_narrative:      "A letter of intent is typically 1–2 pages. Introduce your organization, describe the project, requested amount, and why you are a good fit.",
};

function SectionTip({ sectionKey }: { sectionKey: string }) {
  const tip = TIPS[sectionKey];
  if (!tip) return null;
  return (
    <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 leading-relaxed">
      💡 <strong>Writing tip:</strong> {tip}
    </div>
  );
}
