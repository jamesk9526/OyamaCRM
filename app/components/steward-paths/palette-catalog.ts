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
  { kind: "trigger.new_donation", category: "trigger", label: "New donation", summary: "Start when a gift is received.", readiness: "working", defaultConfig: { minimumAmount: 0, designation: "" } },
  { kind: "trigger.added_to_segment", category: "trigger", label: "Added to segment", summary: "Donor joins a segment.", readiness: "working", defaultConfig: { segmentKey: "High Value Donors" } },
  { kind: "trigger.donor_lapsed", category: "trigger", label: "Donor becomes lapsed", summary: "No gift inside a window.", readiness: "working", defaultConfig: { daysSinceLastGift: 365 } },
  { kind: "trigger.pledge_due", category: "trigger", label: "Pledge due", summary: "Pledge installment becomes due.", readiness: "working", defaultConfig: { dueWithinDays: 14, minimumPledgeAmount: 0 } },
  { kind: "trigger.event_attended", category: "trigger", label: "Event attended", summary: "Constituent attended an event.", readiness: "working", defaultConfig: { eventFilter: "" } },
  { kind: "trigger.manual_enrollment", category: "trigger", label: "Manual enrollment", summary: "Staff enrolls a constituent.", readiness: "working", defaultConfig: { enrollmentNote: "Staff manually enrolls a constituent" } },

  // Timing
  { kind: "timing.delay", category: "timing", label: "Wait N hours/days/weeks/months", summary: "Hold before the next step.", readiness: "working", defaultConfig: { amount: 1, unit: "days" } },
  { kind: "timing.until_date", category: "timing", label: "Wait until date", summary: "Pause until a specific date.", readiness: "working", defaultConfig: { mode: "until_date", dateIso: "" } },
  { kind: "timing.until_weekday_time", category: "timing", label: "Wait until weekday/time", summary: "Hold for the next allowed window.", readiness: "working", defaultConfig: { mode: "until_weekday_time", weekday: 1, hour: 9, minute: 0 } },
  { kind: "timing.after_last_gift", category: "timing", label: "Wait until after last gift", summary: "Anchor delay to last donation.", readiness: "working", defaultConfig: { amount: 30, unit: "days" } },

  // Email
  { kind: "email.create_draft", category: "email", label: "Create email draft", summary: "Create a review-required email draft.", readiness: "working", defaultConfig: { subjectTemplate: "", bodyTemplate: "", includeUnsubscribeLink: true, contentLayout: "single-column" } },
  { kind: "email.send_review_request", category: "email", label: "Send review request", summary: "Notify a reviewer.", readiness: "working", defaultConfig: { owner: "Development Director", waitDays: 1, instruction: "Review this email before donor outreach continues." } },
  { kind: "email.add_to_sequence", category: "email", label: "Add to email sequence", summary: "Enroll donor in an email sequence.", readiness: "working", defaultConfig: { sequenceName: "Welcome Series", instruction: "Enroll donor in the selected email sequence." } },
  { kind: "email.schedule_blast", category: "email", label: "Schedule email blast", summary: "Queue a campaign send.", readiness: "working", defaultConfig: { campaignId: "", scheduleAt: "" } },
  { kind: "email.wait_for_open", category: "email", label: "Wait for email open/click", summary: "Pause until donor engages.", readiness: "working", defaultConfig: { waitDays: 7, instruction: "Wait for email open or click before continuing." } },
  { kind: "email.mark_failed", category: "email", label: "Mark email failed/bounced", summary: "Record delivery failure.", readiness: "working", defaultConfig: { instruction: "Record bounce or failed email and route to staff review." } },

  // Print
  { kind: "print.generate_letter", category: "print", label: "Generate form letter", summary: "Render a letter from a template.", readiness: "working", defaultConfig: { templateId: "" } },
  { kind: "print.add_to_print_queue", category: "print", label: "Add to print queue", summary: "Queue a generated letter for print.", readiness: "working", defaultConfig: { queue: "standard", owner: "Stewardship team" } },
  { kind: "print.require_print_approval", category: "print", label: "Require print approval", summary: "Block print until approval.", readiness: "working", defaultConfig: { queue: "board-review", owner: "Development Director", instruction: "Approve letter before printing." } },
  { kind: "print.mark_printed", category: "print", label: "Mark printed", summary: "Record letter as printed.", readiness: "working", defaultConfig: { queue: "standard", instruction: "Record printed date." } },
  { kind: "print.add_to_mail_queue", category: "print", label: "Add to mail queue", summary: "Queue letter for postal mail.", readiness: "working", defaultConfig: { queue: "standard", owner: "Operations" } },
  { kind: "print.mark_mailed", category: "print", label: "Mark mailed", summary: "Record letter as mailed.", readiness: "working", defaultConfig: { queue: "standard", instruction: "Record mailed date." } },

  // Tasks
  { kind: "task.create", category: "task", label: "Create task", summary: "Create a follow-up task.", readiness: "working", defaultConfig: { title: "Follow up", priority: "MEDIUM" } },
  { kind: "task.assign_staff", category: "task", label: "Assign staff member", summary: "Assign the task to a user.", readiness: "working", defaultConfig: { assignee: "", slaDays: 3, instruction: "Assign this stewardship task to the right staff member." } },
  { kind: "task.wait_for_completion", category: "task", label: "Wait for task completion", summary: "Pause path until task done.", readiness: "working", defaultConfig: { slaDays: 7, instruction: "Wait until the current task is completed." } },
  { kind: "task.escalate_overdue", category: "task", label: "Escalate overdue task", summary: "Notify lead when overdue.", readiness: "working", defaultConfig: { assignee: "Team lead", slaDays: 3, instruction: "Escalate when overdue." } },

  // LiveCom
  { kind: "livecom.send_message", category: "livecom", label: "Send LiveCom message", summary: "Send a guided chat message in LiveCom.", readiness: "working", defaultConfig: { messageTemplate: "Hi {{firstName}}, thank you again for your support.", channel: "inbox" } },
  { kind: "livecom.wait_for_reply", category: "livecom", label: "Wait for LiveCom reply", summary: "Pause until donor replies in chat.", readiness: "working", defaultConfig: { waitDays: 3, instruction: "Wait for donor reply in LiveCom before continuing." } },
  { kind: "livecom.route_to_staff", category: "livecom", label: "Route LiveCom to staff", summary: "Hand off the conversation to a staff owner.", readiness: "working", defaultConfig: { assignee: "Stewardship Team", priority: "MEDIUM", instruction: "Route this LiveCom conversation to a staff owner." } },

  // Donor data
  { kind: "donor.add_tag", category: "donor-data", label: "Add tag", summary: "Tag the donor.", readiness: "working", defaultConfig: { tag: "Engaged Donor" } },
  { kind: "donor.remove_tag", category: "donor-data", label: "Remove tag", summary: "Untag the donor.", readiness: "working", defaultConfig: { tag: "Needs Follow Up" } },
  { kind: "donor.update_status", category: "donor-data", label: "Update donor status", summary: "Change donor status field (uses STATUS_CHANGE step).", readiness: "working", defaultConfig: { value: "ACTIVE" } },
  { kind: "donor.adjust_engagement_score", category: "donor-data", label: "Adjust engagement score", summary: "Set the engagement score 0-100 (uses STATUS_CHANGE step).", readiness: "working", defaultConfig: { value: 65 } },
  { kind: "donor.set_retention_stage", category: "donor-data", label: "Set retention stage", summary: "Set donor retention stage for win-back workflows.", readiness: "working", defaultConfig: { value: "AT_RISK" } },
  { kind: "donor.add_note", category: "donor-data", label: "Add note", summary: "Append an internal note.", readiness: "working", defaultConfig: { noteTemplate: "Stewardship path note added." } },

  // Logic
  { kind: "logic.if_else", category: "logic", label: "If/else branch", summary: "Split the path on a condition (uses BRANCH_PLACEHOLDER step).", readiness: "working" },
  { kind: "logic.segment_condition", category: "logic", label: "Donor segment condition", summary: "Branch by segment membership.", readiness: "working" },
  { kind: "logic.donation_amount_condition", category: "logic", label: "Donation amount condition", summary: "Branch by gift size.", readiness: "working" },
  { kind: "logic.communication_preference_condition", category: "logic", label: "Communication preference condition", summary: "Branch by opt-in/out flags.", readiness: "working" },
  { kind: "logic.email_engagement_condition", category: "logic", label: "Email engagement condition", summary: "Branch on opens/clicks.", readiness: "working" },
  { kind: "logic.retention_risk_condition", category: "logic", label: "Retention risk condition", summary: "Branch by retention risk score and gift recency.", readiness: "working" },

  // Safety / Review
  { kind: "safety.require_human_approval", category: "safety", label: "Require human approval", summary: "Hold for explicit approval.", readiness: "working", defaultConfig: { approver: "Manager", priority: "MEDIUM", instruction: "Approve before continuing." } },
  { kind: "safety.pause_path", category: "safety", label: "Pause path", summary: "Pause this enrollment.", readiness: "working", defaultConfig: { priority: "MEDIUM", instruction: "Pause this donor's path until staff resumes it." } },
  { kind: "safety.notify_staff", category: "safety", label: "Notify staff", summary: "Send a heads-up to the team.", readiness: "working", defaultConfig: { notify: "Stewardship team", priority: "MEDIUM", instruction: "Notify staff about this donor." } },
  { kind: "safety.stop_enrollment", category: "safety", label: "Stop enrollment", summary: "End the enrollment immediately.", readiness: "working", defaultConfig: { priority: "HIGH", instruction: "Stop this path for the donor." } },
];

/** Human-readable category headings used by the palette UI. */
export const CATEGORY_LABELS: Record<NodePaletteItem["category"], string> = {
  trigger: "Triggers",
  timing: "Timing",
  email: "Email Actions",
  print: "Print Actions",
  task: "Task Actions",
  livecom: "LiveCom Actions",
  "donor-data": "Donor Data Actions",
  logic: "Logic",
  safety: "Safety / Review",
};
