import { describe, expect, it } from "vitest";
import { buildCommunicationsControlGroups } from "@/app/components/workspace/workspace-presets";

describe("buildCommunicationsControlGroups", () => {
  it("returns grouped controls with expected view, related, and action sections", () => {
    const groups = buildCommunicationsControlGroups({
      activeView: "overview",
      campaignCount: 4,
      draftsNeedingReview: 2,
      sendQueueCount: 1,
      communicationLogCount: 9,
      canOpenBuilder: true,
    });

    expect(groups.map((group) => group.id)).toEqual([
      "workspace-views",
      "related-workspaces",
      "quick-actions",
    ]);

    const views = groups.find((group) => group.id === "workspace-views");
    expect(views?.items.find((item) => item.id === "view:email-campaigns")?.badge).toBe(4);
    expect(views?.items.find((item) => item.id === "view:email-drafts")?.badge).toBe(2);
    expect(views?.items.find((item) => item.id === "view:send-queue")?.badge).toBe(1);
    expect(views?.items.find((item) => item.id === "view:communication-log")?.badge).toBe(9);
  });

  it("disables open-email-builder action when no campaign exists", () => {
    const groups = buildCommunicationsControlGroups({
      activeView: "overview",
      campaignCount: 0,
      draftsNeedingReview: 0,
      sendQueueCount: 0,
      communicationLogCount: 0,
      canOpenBuilder: false,
    });

    const quickActions = groups.find((group) => group.id === "quick-actions");
    const openBuilder = quickActions?.items.find((item) => item.id === "action:open-email-builder");

    expect(openBuilder?.disabled).toBe(true);
    expect(openBuilder?.disabledReason).toBe("Create a campaign first");
  });
});
