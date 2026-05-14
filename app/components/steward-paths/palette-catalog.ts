/**
 * Catalog of palette blocks shown in the Steward Paths visual builder.
 *
 * Each entry defines its category, label, summary, and execution readiness so
 * the palette and the node cards both reflect honest "Working / Partially
 * Working / Not Implemented" state.
 *
 * Adding a new step type means adding it here and (when execution lands) in
 * `server/src/services/steward-paths-sequence-engine.ts`.
 */
import type { NodePaletteItem } from "./workflow-types";

/** All palette blocks, grouped logically by category for rendering. */
export const PALETTE_ITEMS: NodePaletteItem[] = [
  // Triggers
  { kind: "trigger.new_donation", category: "trigger", label: "New donation", summary: "Start when a gift is received.", readiness: "working" },
  { kind: "trigger.added_to_segment", category: "trigger", label: "Added to segment", summary: "Donor joins a segment.", readiness: "working" },
  { kind: "trigger.donor_lapsed", category: "trigger", label: "Donor becomes lapsed", summary: "No gift inside a window.", readiness: "working" },
  { kind: "trigger.pledge_due", category: "trigger", label: "Pledge due", summary: "Pledge installment becomes due.", readiness: "working" },
  { kind: "trigger.event_attended", category: "trigger", label: "Event attended", summary: "Constituent attended an event.", readiness: "working" },
  { kind: "trigger.manual_enrollment", category: "trigger", label: "Manual enrollment", summary: "Staff enrolls a constituent.", readiness: "working" },

  // Timing
  { kind: "timing.delay", category: "timing", label: "Wait N hours/days/weeks/months", summary: "Hold before the next step.", readiness: "working", defaultConfig: { amount: 1, unit: "days" } },
  { kind: "timing.until_date", category: "timing", label: "Wait until date", summary: "Pause until a specific date.", readiness: "working" },
  { kind: "timing.until_weekday_time", category: "timing", label: "Wait until weekday/time", summary: "Hold for the next allowed window.", readiness: "working" },
  { kind: "timing.after_last_gift", category: "timing", label: "Wait until after last gift", summary: "Anchor delay to last donation.", readiness: "working" },

  // Email
  { kind: "email.create_draft", category: "email", label: "Create email draft", summary: "Create a review-required email draft.", readiness: "working" },
  { kind: "email.send_review_request", category: "email", label: "Send review request", summary: "Notify a reviewer.", readiness: "working" },
  { kind: "email.add_to_sequence", category: "email", label: "Add to email sequence", summary: "Enroll donor in an email sequence.", readiness: "working" },
  { kind: "email.schedule_blast", category: "email", label: "Schedule email blast", summary: "Queue a campaign send.", readiness: "working" },
  { kind: "email.wait_for_open", category: "email", label: "Wait for email open/click", summary: "Pause until donor engages.", readiness: "working" },
  { kind: "email.mark_failed", category: "email", label: "Mark email failed/bounced", summary: "Record delivery failure.", readiness: "working" },

  // Print
  { kind: "print.generate_letter", category: "print", label: "Generate form letter", summary: "Render a letter from a template.", readiness: "working", defaultConfig: { templateId: "" } },
  { kind: "print.add_to_print_queue", category: "print", label: "Add to print queue", summary: "Queue a generated letter for print.", readiness: "working" },
  { kind: "print.require_print_approval", category: "print", label: "Require print approval", summary: "Block print until approval.", readiness: "working" },
  { kind: "print.mark_printed", category: "print", label: "Mark printed", summary: "Record letter as printed.", readiness: "working" },
  { kind: "print.add_to_mail_queue", category: "print", label: "Add to mail queue", summary: "Queue letter for postal mail.", readiness: "working" },
  { kind: "print.mark_mailed", category: "print", label: "Mark mailed", summary: "Record letter as mailed.", readiness: "working" },

  // Tasks
  { kind: "task.create", category: "task", label: "Create task", summary: "Create a follow-up task.", readiness: "working", defaultConfig: { title: "Follow up", priority: "MEDIUM" } },
  { kind: "task.assign_staff", category: "task", label: "Assign staff member", summary: "Assign the task to a user.", readiness: "working" },
  { kind: "task.wait_for_completion", category: "task", label: "Wait for task completion", summary: "Pause path until task done.", readiness: "working" },
  { kind: "task.escalate_overdue", category: "task", label: "Escalate overdue task", summary: "Notify lead when overdue.", readiness: "working" },

  // Donor data
  { kind: "donor.add_tag", category: "donor-data", label: "Add tag", summary: "Tag the donor.", readiness: "working" },
  { kind: "donor.remove_tag", category: "donor-data", label: "Remove tag", summary: "Untag the donor.", readiness: "working" },
  { kind: "donor.update_status", category: "donor-data", label: "Update donor status", summary: "Change donor status field (uses STATUS_CHANGE step).", readiness: "working" },
  { kind: "donor.adjust_engagement_score", category: "donor-data", label: "Adjust engagement score", summary: "Set the engagement score 0-100 (uses STATUS_CHANGE step).", readiness: "working" },
  { kind: "donor.add_note", category: "donor-data", label: "Add note", summary: "Append an internal note.", readiness: "working" },

  // Logic
  { kind: "logic.if_else", category: "logic", label: "If/else branch", summary: "Split the path on a condition (uses BRANCH_PLACEHOLDER step).", readiness: "working" },
  { kind: "logic.segment_condition", category: "logic", label: "Donor segment condition", summary: "Branch by segment membership.", readiness: "working" },
  { kind: "logic.donation_amount_condition", category: "logic", label: "Donation amount condition", summary: "Branch by gift size.", readiness: "working" },
  { kind: "logic.communication_preference_condition", category: "logic", label: "Communication preference condition", summary: "Branch by opt-in/out flags.", readiness: "working" },
  { kind: "logic.email_engagement_condition", category: "logic", label: "Email engagement condition", summary: "Branch on opens/clicks.", readiness: "working" },

  // Safety / Review
  { kind: "safety.require_human_approval", category: "safety", label: "Require human approval", summary: "Hold for explicit approval.", readiness: "working" },
  { kind: "safety.pause_path", category: "safety", label: "Pause path", summary: "Pause this enrollment.", readiness: "working" },
  { kind: "safety.notify_staff", category: "safety", label: "Notify staff", summary: "Send a heads-up to the team.", readiness: "working" },
  { kind: "safety.stop_enrollment", category: "safety", label: "Stop enrollment", summary: "End the enrollment immediately.", readiness: "working" },
];

/** Human-readable category headings used by the palette UI. */
export const CATEGORY_LABELS: Record<NodePaletteItem["category"], string> = {
  trigger: "Triggers",
  timing: "Timing",
  email: "Email Actions",
  print: "Print Actions",
  task: "Task Actions",
  "donor-data": "Donor Data Actions",
  logic: "Logic",
  safety: "Safety / Review",
};
