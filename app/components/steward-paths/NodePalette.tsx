/**
 * NodePalette renders the left Add Node rail for the visual builder.
 * Styled to match the workspace mockup while preserving drag/click behavior.
 */
"use client";

import { useMemo, useState } from "react";
import { PALETTE_ITEMS } from "./palette-catalog";
import type { NodeCategory, NodePaletteItem } from "./workflow-types";

interface NodePaletteProps {
  /** Called when the user clicks a palette block to add it. */
  onAdd: (item: NodePaletteItem) => void;
  /** Optional text describing where the next add action inserts in the canvas. */
  insertionTargetLabel?: string;
}

type PaletteSectionKey = "triggers" | "actions" | "flow-control" | "exit";

/** Top-level sections and their mapped categories. */
const SECTIONS: Array<{
  key: PaletteSectionKey;
  label: string;
  categories: NodeCategory[];
}> = [
  { key: "triggers", label: "TRIGGERS", categories: ["trigger"] },
  { key: "actions", label: "ACTIONS", categories: ["email", "print", "task", "livecom", "donor-data"] },
  { key: "flow-control", label: "FLOW CONTROL", categories: ["timing", "logic"] },
  { key: "exit", label: "EXIT", categories: ["safety"] },
];

const SECTION_VISIBLE_LIMIT = 4;

/** Returns an SVG icon element for a palette item based on its category/kind. */
function PaletteItemIcon({ kind, category }: { kind: string; category: NodeCategory }) {
  const cls = "h-4 w-4 shrink-0";

  if (category === "trigger") {
    if (kind.includes("donation")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 13.5S2.5 10 2.5 6a5.5 5.5 0 0111 0c0 4-5.5 7.5-5.5 7.5z" />
        </svg>
      );
    }
    if (kind.includes("form")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" d="M5 6h6M5 9h4" />
        </svg>
      );
    }
    if (kind.includes("event")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="10" rx="1.5" /><path strokeLinecap="round" d="M5 2v3M11 2v3M2 7h12" />
        </svg>
      );
    }
    if (kind.includes("api")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 5.5L2 8l3.5 2.5M10.5 5.5L14 8l-3.5 2.5M9 4l-2 8" />
        </svg>
      );
    }
    if (kind.includes("tag")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
        </svg>
      );
    }
    // default trigger = person/segment
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    );
  }

  if (category === "email") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5l6.5 4 6.5-4" />
      </svg>
    );
  }

  if (category === "print") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5V2h8v3M2 5h12a1 1 0 011 1v5a1 1 0 01-1 1h-2v2H4v-2H2a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </svg>
    );
  }

  if (category === "task") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l2 2 3-3" />
      </svg>
    );
  }

  if (category === "livecom") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5h12v7H8l-3.5 3v-3H2z" />
      </svg>
    );
  }

  if (category === "donor-data") {
    if (kind.includes("tag")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
        </svg>
      );
    }
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    );
  }

  if (category === "safety") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2L3 4.5v4c0 3.1 2.5 5.5 5 6.5 2.5-1 5-3.4 5-6.5v-4L8 2z" />
      </svg>
    );
  }

  if (category === "timing") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 5v3l2.5 1.5" />
      </svg>
    );
  }

  if (category === "logic") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M5 7l3 2 3-2M5 11h6M4 13h2M10 13h2" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
    </svg>
  );
}

/** Per-section tone styling for cards and headings. */
function sectionTone(section: PaletteSectionKey): {
  headingClass: string;
  cardClass: string;
  iconWrapClass: string;
  iconClass: string;
  showAllClass: string;
} {
  if (section === "triggers") {
    return {
      headingClass: "text-emerald-800",
      cardClass: "border-emerald-200 bg-emerald-50/45 hover:bg-emerald-50",
      iconWrapClass: "bg-emerald-100 ring-1 ring-emerald-200",
      iconClass: "text-emerald-700",
      showAllClass: "text-emerald-700 hover:text-emerald-800",
    };
  }
  if (section === "actions") {
    return {
      headingClass: "text-blue-800",
      cardClass: "border-blue-200 bg-blue-50/45 hover:bg-blue-50",
      iconWrapClass: "bg-blue-100 ring-1 ring-blue-200",
      iconClass: "text-blue-700",
      showAllClass: "text-blue-700 hover:text-blue-800",
    };
  }
  if (section === "flow-control") {
    return {
      headingClass: "text-violet-800",
      cardClass: "border-violet-200 bg-violet-50/45 hover:bg-violet-50",
      iconWrapClass: "bg-violet-100 ring-1 ring-violet-200",
      iconClass: "text-violet-700",
      showAllClass: "text-violet-700 hover:text-violet-800",
    };
  }
  return {
    headingClass: "text-rose-800",
    cardClass: "border-rose-200 bg-rose-50/45 hover:bg-rose-50",
    iconWrapClass: "bg-rose-100 ring-1 ring-rose-200",
    iconClass: "text-rose-700",
    showAllClass: "text-rose-700 hover:text-rose-800",
  };
}

/** Shortens internal step names to match the compact builder rail. */
function displayPaletteLabel(item: NodePaletteItem): string {
  const replacements: Record<string, string> = {
    "trigger.new_donation": "Donation Received",
    "trigger.added_to_segment": "Segment Entry",
    "trigger.donor_lapsed": "Donor Lapsed",
    "trigger.pledge_due": "Pledge Due",
    "trigger.event_attended": "Event Attended",
    "trigger.manual_enrollment": "Manual Enrollment",

    "timing.delay": "Wait / Delay",
    "timing.until_date": "Wait Until Date",
    "timing.until_weekday_time": "Wait Until Day/Time",
    "timing.after_last_gift": "Wait After Last Gift",

    "email.create_draft": "Create Email Draft",
    "email.send_review_request": "Request Email Review",
    "email.add_to_sequence": "Add to Email Sequence",
    "email.schedule_blast": "Schedule Email Blast",
    "email.wait_for_open": "Wait for Open/Click",
    "email.mark_failed": "Mark Email Failed",

    "print.generate_letter": "Generate Letter",
    "print.add_to_print_queue": "Queue for Print",
    "print.require_print_approval": "Require Print Approval",
    "print.mark_printed": "Mark Printed",
    "print.add_to_mail_queue": "Queue for Mail",
    "print.mark_mailed": "Mark Mailed",

    "task.create": "Create Task",
    "task.assign_staff": "Assign Staff",
    "task.wait_for_completion": "Wait for Task Done",
    "task.escalate_overdue": "Escalate Overdue Task",

    "livecom.send_message": "Send LiveCom Message",
    "livecom.wait_for_reply": "Wait for LiveCom Reply",
    "livecom.route_to_staff": "Route LiveCom to Staff",

    "donor.add_tag": "Add Donor Tag",
    "donor.remove_tag": "Remove Donor Tag",
    "donor.update_status": "Update Donor Status",
    "donor.adjust_engagement_score": "Set Engagement Score",
    "donor.set_retention_stage": "Set Retention Stage",
    "donor.add_note": "Add Donor Note",

    "logic.if_else": "If / Else Branch",
    "logic.segment_condition": "Segment Condition",
    "logic.donation_amount_condition": "Donation Amount Condition",
    "logic.communication_preference_condition": "Communication Preference Condition",
    "logic.email_engagement_condition": "Email Engagement Condition",
    "logic.retention_risk_condition": "Retention Risk Condition",

    "safety.require_human_approval": "Require Human Approval",
    "safety.pause_path": "Pause Path",
    "safety.notify_staff": "Notify Staff",
    "safety.stop_enrollment": "Stop Enrollment",
  };

  return replacements[item.kind] ?? item.label;
}

/** Optional shorter subtitle copy for compact cards. */
function displayPaletteSummary(item: NodePaletteItem): string {
  const replacements: Record<string, string> = {
    "trigger.new_donation": "Start when a donation is received",
    "trigger.added_to_segment": "Start when donor enters a segment",
    "trigger.donor_lapsed": "Start when donor has lapsed",
    "trigger.pledge_due": "Start when a pledge payment is due",
    "trigger.event_attended": "Start when an event is attended",
    "trigger.manual_enrollment": "Enroll a donor manually",

    "timing.delay": "Pause for a fixed amount of time",
    "timing.until_date": "Pause until a specific date",
    "timing.until_weekday_time": "Pause until an allowed day/time",
    "timing.after_last_gift": "Pause relative to last donation",

    "email.create_draft": "Draft and link an email for this path",
    "email.send_review_request": "Send review request before sending",
    "email.add_to_sequence": "Enroll donor in a sequence",
    "email.schedule_blast": "Schedule a linked campaign send",
    "email.wait_for_open": "Wait for open or click activity",
    "email.mark_failed": "Record delivery failure",

    "print.generate_letter": "Generate a linked letter template",
    "print.add_to_print_queue": "Queue letter for printing",
    "print.require_print_approval": "Hold until print approval",
    "print.mark_printed": "Record print completion",
    "print.add_to_mail_queue": "Queue letter for mailing",
    "print.mark_mailed": "Record mail completion",

    "task.create": "Create a stewardship task",
    "task.assign_staff": "Assign ownership to staff",
    "task.wait_for_completion": "Wait for task completion",
    "task.escalate_overdue": "Escalate when overdue",

    "livecom.send_message": "Send a LiveCom message",
    "livecom.wait_for_reply": "Wait for donor reply",
    "livecom.route_to_staff": "Hand off chat to staff",

    "donor.add_tag": "Add donor record tag",
    "donor.remove_tag": "Remove donor record tag",
    "donor.update_status": "Update donor status",
    "donor.adjust_engagement_score": "Set engagement score",
    "donor.set_retention_stage": "Set retention stage",
    "donor.add_note": "Add internal donor note",

    "logic.if_else": "Route by branch conditions",
    "logic.segment_condition": "Branch by segment membership",
    "logic.donation_amount_condition": "Branch by donation amount",
    "logic.communication_preference_condition": "Branch by communication preferences",
    "logic.email_engagement_condition": "Branch by email engagement",
    "logic.retention_risk_condition": "Branch by retention risk",

    "safety.require_human_approval": "Pause until a human approves",
    "safety.pause_path": "Pause this enrollment",
    "safety.notify_staff": "Send a staff alert",
    "safety.stop_enrollment": "End this enrollment immediately",
  };
  return replacements[item.kind] ?? item.summary;
}

/** Left Add Node rail with grouped cards and quick-add controls. */
export default function NodePalette({ onAdd, insertionTargetLabel }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const [showAllBySection, setShowAllBySection] = useState<Record<PaletteSectionKey, boolean>>({
    triggers: false,
    actions: false,
    "flow-control": false,
    exit: false,
  });

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SECTIONS.map((section) => {
      const items = PALETTE_ITEMS.filter(
        (item) => section.categories.includes(item.category as NodeCategory),
      ).filter((item) =>
        !needle
          || item.label.toLowerCase().includes(needle)
          || item.summary.toLowerCase().includes(needle)
          || item.kind.toLowerCase().includes(needle),
      );
      return { ...section, items };
    }).filter((s) => s.items.length > 0);
  }, [query]);

  return (
    <aside className="flex h-full w-[330px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Add Node</h2>
          <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Palette settings">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h4M3 8h10M5 14h6" />
            </svg>
          </button>
        </div>

        <div className="relative mt-2.5">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nodes..."
            className="h-9 w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
          />
        </div>

        {insertionTargetLabel ? (
          <p className="mt-1.5 truncate text-[11px] text-emerald-700">{insertionTargetLabel}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {sections.map((section) => {
          const tone = sectionTone(section.key);
          const showAll = showAllBySection[section.key];
          const visibleItems = showAll ? section.items : section.items.slice(0, SECTION_VISIBLE_LIMIT);
          return (
            <section key={section.key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={`text-[10px] font-bold uppercase tracking-widest ${tone.headingClass}`}>
                  {section.label}
                </h3>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {section.items.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {visibleItems.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-oyama-palette-kind", item.kind);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(item)}
                    className={`group flex min-h-[64px] flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition ${tone.cardClass}`}
                  >
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${tone.iconWrapClass}`}>
                      <span className={tone.iconClass}>
                        <PaletteItemIcon kind={item.kind} category={item.category as NodeCategory} />
                      </span>
                    </span>
                    <p className="line-clamp-1 text-[11px] font-semibold leading-4 text-slate-900">{displayPaletteLabel(item)}</p>
                    <p className="line-clamp-1 text-[10px] leading-4 text-slate-600">{displayPaletteSummary(item)}</p>
                  </button>
                ))}
              </div>

              {section.items.length > SECTION_VISIBLE_LIMIT ? (
                <button
                  type="button"
                  onClick={() => setShowAllBySection((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  className={`mt-2 text-xs font-semibold ${tone.showAllClass}`}
                >
                  {showAll ? "Show less" : "Show all"}
                </button>
              ) : null}
            </section>
          );
        })}

        {sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
            No nodes match your search.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 px-3 py-2.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h6M6 8h6M6 12h6" />
            <circle cx="3" cy="4" r="1" fill="currentColor" />
            <circle cx="3" cy="8" r="1" fill="currentColor" />
            <circle cx="3" cy="12" r="1" fill="currentColor" />
          </svg>
          <span>Drag a node to the canvas to add it to your path.</span>
        </div>
      </div>
    </aside>
  );
}
