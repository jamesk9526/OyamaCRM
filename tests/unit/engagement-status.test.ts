/**
 * Unit tests for the shared donor-engagement status vocabulary.
 *
 * Verifies channel-specific backend statuses map to the locked user-facing
 * labels documented in `docs/DONOR_ENGAGEMENT_SYSTEM.md`.
 */
import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_STATUS_LEGEND,
  ENGAGEMENT_STATUS_TONE_CLASSES,
  ENGAGEMENT_STATUS_TONES,
  getEngagementStatusChipClass,
  getEngagementStatusTone,
  toEngagementStatusLabel,
} from "@/app/lib/engagement-status";

describe("toEngagementStatusLabel", () => {
  it("maps email campaign statuses to shared labels", () => {
    expect(toEngagementStatusLabel("email", "DRAFT")).toBe("Draft");
    expect(toEngagementStatusLabel("email", "SCHEDULED")).toBe("Scheduled");
    expect(toEngagementStatusLabel("email", "SENDING")).toBe("Scheduled");
    expect(toEngagementStatusLabel("email", "SENT")).toBe("Sent");
    expect(toEngagementStatusLabel("email", "CANCELLED")).toBe("Canceled");
    expect(toEngagementStatusLabel("email", "FAILED")).toBe("Failed");
  });

  it("maps generated letter statuses to shared labels", () => {
    expect(toEngagementStatusLabel("letter", "GENERATED")).toBe("Generated");
    expect(toEngagementStatusLabel("letter", "QUEUED_FOR_PRINT")).toBe("Queued For Print");
    expect(toEngagementStatusLabel("letter", "PRINTED")).toBe("Printed");
    expect(toEngagementStatusLabel("letter", "QUEUED_FOR_MAIL")).toBe("Queued For Mail");
    expect(toEngagementStatusLabel("letter", "MAILED")).toBe("Mailed");
    expect(toEngagementStatusLabel("letter", "EMAIL_DRAFT_CREATED")).toBe("Draft");
    expect(toEngagementStatusLabel("letter", "ARCHIVED")).toBe("Archived");
  });

  it("maps steward path draft, step run, and enrollment statuses", () => {
    expect(toEngagementStatusLabel("pathDraft", "DRAFT_CREATED")).toBe("Draft");
    expect(toEngagementStatusLabel("pathDraft", "READY_FOR_REVIEW")).toBe("Needs Review");
    expect(toEngagementStatusLabel("pathDraft", "APPROVED")).toBe("Approved");
    expect(toEngagementStatusLabel("pathDraft", "SENT")).toBe("Sent");
    expect(toEngagementStatusLabel("pathDraft", "SKIPPED")).toBe("Canceled");

    expect(toEngagementStatusLabel("pathStepRun", "RUNNING")).toBe("Scheduled");
    expect(toEngagementStatusLabel("pathStepRun", "COMPLETED")).toBe("Completed");
    expect(toEngagementStatusLabel("pathStepRun", "FAILED")).toBe("Failed");

    expect(toEngagementStatusLabel("pathEnrollment", "ACTIVE")).toBe("Scheduled");
    expect(toEngagementStatusLabel("pathEnrollment", "PAUSED")).toBe("Needs Review");
    expect(toEngagementStatusLabel("pathEnrollment", "COMPLETED")).toBe("Completed");
  });

  it("maps task statuses to shared labels", () => {
    expect(toEngagementStatusLabel("task", "PENDING")).toBe("Scheduled");
    expect(toEngagementStatusLabel("task", "COMPLETED")).toBe("Completed");
    expect(toEngagementStatusLabel("task", "CANCELLED")).toBe("Canceled");
  });

  it("falls back to title-case for unknown values without surfacing raw enums", () => {
    // Unknown email value should be presented in human form, not as the enum literal.
    expect(toEngagementStatusLabel("email", "PARTIALLY_FAILED")).toBe("Partially Failed");
    expect(toEngagementStatusLabel("letter", "weird-status")).toBe("Weird Status");
  });

  it("treats null/empty status as Draft to keep UI safe", () => {
    expect(toEngagementStatusLabel("email", null)).toBe("Draft");
    expect(toEngagementStatusLabel("email", undefined)).toBe("Draft");
    expect(toEngagementStatusLabel("email", "")).toBe("Draft");
  });
});

describe("engagement status tone helpers", () => {
  it("returns the documented tone for every legend label", () => {
    for (const label of ENGAGEMENT_STATUS_LEGEND) {
      const tone = getEngagementStatusTone(label);
      expect(ENGAGEMENT_STATUS_TONES[label]).toBe(tone);
      expect(ENGAGEMENT_STATUS_TONE_CLASSES[tone]).toBeTruthy();
    }
  });

  it("returns a Tailwind chip class for known labels", () => {
    expect(getEngagementStatusChipClass("Sent")).toBe("bg-green-100 text-green-700");
    expect(getEngagementStatusChipClass("Failed")).toBe("bg-red-100 text-red-600");
    expect(getEngagementStatusChipClass("Draft")).toBe("bg-slate-100 text-slate-700");
  });

  it("falls back to neutral for unmapped labels", () => {
    expect(getEngagementStatusTone("Something New")).toBe("neutral");
    expect(getEngagementStatusChipClass("Something New")).toBe("bg-gray-100 text-gray-700");
  });
});

describe("ENGAGEMENT_STATUS_LEGEND", () => {
  it("contains the documented status set in the documented order", () => {
    expect(ENGAGEMENT_STATUS_LEGEND).toEqual([
      "Draft",
      "Needs Review",
      "Approved",
      "Scheduled",
      "Sent",
      "Generated",
      "Queued For Print",
      "Printed",
      "Queued For Mail",
      "Mailed",
      "Completed",
      "Failed",
      "Canceled",
      "Archived",
    ]);
  });
});
