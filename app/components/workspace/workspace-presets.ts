/**
 * Preset builders for workspace control rail group definitions.
 */
import type { WorkspaceControlGroup } from "./workspace-types";

interface CommunicationsControlPresetOptions {
  activeView: string;
  campaignCount: number;
  draftsNeedingReview: number;
  sendQueueCount: number;
  communicationLogCount: number;
  canOpenBuilder: boolean;
}

/** Builds grouped right-rail controls for the Communications workspace. */
export function buildCommunicationsControlGroups(options: CommunicationsControlPresetOptions): WorkspaceControlGroup[] {
  return [
    {
      id: "workspace-views",
      label: "Workspace Views",
      items: [
        { id: "view:overview", label: "Overview", badge: options.activeView === "overview" ? "Active" : undefined, status: "Working" },
        { id: "view:email-campaigns", label: "Email Campaigns", badge: options.campaignCount, status: "Working" },
        { id: "view:email-drafts", label: "Email Drafts", badge: options.draftsNeedingReview, status: "Working" },
        { id: "view:templates", label: "Templates", status: "Working" },
        { id: "view:segments", label: "Segments", status: "Working" },
        { id: "view:send-queue", label: "Send Queue", badge: options.sendQueueCount, status: "Working" },
        { id: "view:communication-log", label: "Communication Log", badge: options.communicationLogCount, status: "Partially Working" },
        { id: "view:settings", label: "Settings", status: "Working" },
      ],
    },
    {
      id: "related-workspaces",
      label: "Related Workspaces",
      items: [
        {
          id: "related:letters-printables",
          label: "Letters & Printables",
          description: "Print/mail queues and generated letter workflows",
          href: "/letters-printables",
          external: true,
          status: "Working",
        },
      ],
    },
    {
      id: "quick-actions",
      label: "Quick Actions",
      items: [
        { id: "action:new-campaign", label: "New Campaign", status: "Working" },
        {
          id: "action:open-email-builder",
          label: "Open Email Builder",
          status: "Working",
          disabled: !options.canOpenBuilder,
          disabledReason: options.canOpenBuilder ? undefined : "Create a campaign first",
        },
        { id: "action:review-drafts", label: "Review Drafts", badge: options.draftsNeedingReview, status: "Working" },
        { id: "action:view-scheduled", label: "View Scheduled Sends", badge: options.sendQueueCount, status: "Working" },
      ],
    },
  ];
}
