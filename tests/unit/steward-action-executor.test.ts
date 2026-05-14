import { describe, expect, it, vi } from "vitest";
import { executeStewardSuggestedAction } from "@/app/components/ai/steward-action-executor";
import type { StewardStructuredResponse } from "@/app/components/ai/steward-artifact-types";

function structuredBase(): StewardStructuredResponse {
  return {
    version: 1,
    replyMarkdown: "Test reply",
    artifacts: [],
    suggestedActions: [],
    evidence: [],
  };
}

describe("steward-action-executor", () => {
  it("ignores unknown action types safely", async () => {
    const result = await executeStewardSuggestedAction({
      action: { label: "Unknown", actionType: "unknown.action" },
      structured: structuredBase(),
      confirm: vi.fn().mockResolvedValue(true),
      callApi: vi.fn(),
      navigate: vi.fn(),
      copyText: vi.fn(),
    });

    expect(result.status).toBe("ignored");
    expect(result.message).toContain("not available");
  });

  it("requires confirmation before creating a follow-up task", async () => {
    const callApi = vi.fn();
    const result = await executeStewardSuggestedAction({
      action: {
        label: "Create Task",
        actionType: "tasks.create_follow_up_task",
        payload: { donorId: "donor-1" },
      },
      structured: structuredBase(),
      confirm: vi.fn().mockResolvedValue(false),
      callApi,
      navigate: vi.fn(),
      copyText: vi.fn(),
    });

    expect(result.status).toBe("cancelled");
    expect(callApi).not.toHaveBeenCalled();
  });

  it("saves an email draft through steward-signals route", async () => {
    const callApi = vi.fn().mockResolvedValue({ ok: true });
    const result = await executeStewardSuggestedAction({
      action: {
        label: "Save Draft",
        actionType: "communications.create_email_draft",
        payload: { donorId: "donor-55", donorName: "Alex" },
      },
      structured: {
        ...structuredBase(),
        artifacts: [
          {
            type: "email_draft",
            subject: "Thank you",
            body: "Body",
            bodyMarkdown: "Body",
            bodyPlainText: "Body",
            previewText: "Preview",
          },
        ],
      },
      confirm: vi.fn().mockResolvedValue(true),
      callApi,
      navigate: vi.fn(),
      copyText: vi.fn(),
    });

    expect(result.status).toBe("executed");
    expect(callApi).toHaveBeenCalledWith(
      "/api/steward-signals/email-draft/save",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("copies donor list as CSV text", async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);
    const result = await executeStewardSuggestedAction({
      action: {
        label: "Copy Donor List",
        actionType: "copy_donor_list",
      },
      structured: {
        ...structuredBase(),
        artifacts: [
          {
            type: "donor_list",
            columns: ["id", "name"],
            rows: [
              { id: "d1", name: "Pat" },
              { id: "d2", name: "Sam" },
            ],
          },
        ],
      },
      confirm: vi.fn().mockResolvedValue(true),
      callApi: vi.fn(),
      navigate: vi.fn(),
      copyText,
    });

    expect(result.status).toBe("executed");
    expect(copyText).toHaveBeenCalledOnce();
    expect(copyText.mock.calls[0][0]).toContain("id,name");
    expect(copyText.mock.calls[0][0]).toContain("d1,Pat");
  });

  it("opens donor profile route for open_donor action", async () => {
    const navigate = vi.fn();
    const result = await executeStewardSuggestedAction({
      action: {
        label: "Open Donor",
        actionType: "open_donor",
        payload: { donorId: "abc123" },
      },
      structured: structuredBase(),
      confirm: vi.fn().mockResolvedValue(true),
      callApi: vi.fn(),
      navigate,
      copyText: vi.fn(),
    });

    expect(result.status).toBe("executed");
    expect(navigate).toHaveBeenCalledWith("/constituents/abc123");
  });
});
