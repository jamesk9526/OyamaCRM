import type { CrmRibbonPageConfig } from "@/app/components/ui/crm/ribbon/types";

const DASHBOARD_CONFIG: CrmRibbonPageConfig = {
  id: "dashboard",
  pageLabel: "Dashboard",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "dashboard-core",
          label: "Dashboard",
          commands: [
            { id: "refresh-dashboard", label: "Refresh Data" },
            { id: "customize-dashboard", label: "Customize Dashboard" },
            { id: "set-date-range", label: "Date Range" },
            { id: "quick-add", label: "Quick Add" },
            { id: "open-steward", label: "Open Steward", href: "/steward-ai-workspace" },
            { id: "export-snapshot", label: "Export Snapshot", disabledReason: "Snapshot export is not wired for this dashboard yet." },
          ],
        },
      ],
    },
    {
      id: "insights",
      label: "Insights",
      groups: [
        {
          id: "insights-tools",
          label: "Insights",
          commands: [
            { id: "needs-attention", label: "Needs Attention" },
            { id: "steward-recommendations", label: "Steward Recommendations" },
            { id: "giving-trends", label: "Giving Trends" },
            { id: "donor-activity", label: "Donor Activity" },
            { id: "campaign-health", label: "Campaign Health" },
          ],
        },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      groups: [
        {
          id: "dashboard-reports",
          label: "Reports",
          commands: [
            { id: "open-reports", label: "Open Reports", href: "/reports" },
            { id: "export-dashboard-report", label: "Export", disabledReason: "Report export is not available from this dashboard ribbon yet." },
          ],
        },
      ],
    },
    {
      id: "view",
      label: "View",
      groups: [
        {
          id: "dashboard-view",
          label: "View",
          commands: [
            { id: "card-layout", label: "Card Layout" },
            { id: "compact-layout", label: "Compact Layout" },
            { id: "toggle-widgets", label: "Show/Hide Widgets" },
            { id: "reset-layout", label: "Reset Layout" },
          ],
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      groups: [
        {
          id: "dashboard-help",
          label: "Help",
          commands: [{ id: "open-help-dashboard", label: "Help", href: "/help?scope=donor&scopePath=/" }],
        },
      ],
    },
  ],
};

const CONSTITUENTS_CONFIG: CrmRibbonPageConfig = {
  id: "constituents",
  pageLabel: "Constituents",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "constituents-home",
          label: "Constituents",
          commands: [
            { id: "new-constituent", label: "New Constituent", href: "/constituents/new" },
            { id: "import-constituents", label: "Import", href: "/data-tools/import?target=constituents" },
            { id: "view-all-constituents", label: "All Constituents" },
            { id: "view-active-donors", label: "Active Donors" },
            { id: "view-prospects", label: "Prospects" },
          ],
        },
      ],
    },
    {
      id: "constituent-tools",
      label: "Constituents",
      groups: [
        {
          id: "constituent-management",
          label: "Manage",
          commands: [
            { id: "merge-constituents", label: "Merge", requiredSelectionMin: 2, disabledReason: "Select at least 2 constituents to merge." },
            { id: "dedupe-constituents", label: "De-duplicate", disabledReason: "De-duplicate flow is not connected for this view yet." },
            { id: "bulk-update-constituents", label: "Bulk Update", requiredSelectionMin: 1, disabledReason: "Select at least 1 constituent to bulk update." },
            { id: "tag-constituents", label: "Tag", requiredSelectionMin: 1, disabledReason: "Select at least 1 constituent to tag." },
            { id: "assign-owner-constituents", label: "Assign Owner", requiredSelectionMin: 1, disabledReason: "Select at least 1 constituent to assign an owner." },
            { id: "archive-constituents", label: "Archive", requiredSelectionMin: 1, disabledReason: "Select at least 1 constituent to archive." },
          ],
        },
      ],
    },
    {
      id: "giving",
      label: "Giving",
      groups: [
        {
          id: "constituent-giving",
          label: "Giving",
          commands: [
            { id: "add-gift", label: "Add Gift", href: "/donations?recordGift=1" },
            { id: "gift-history", label: "Gift History", href: "/donations" },
            { id: "giving-summary", label: "Giving Summary", href: "/reports/donor-crm" },
            { id: "receipt-status", label: "Receipt Status", href: "/donations" },
            { id: "recurring-giving", label: "Recurring Giving", href: "/donations" },
          ],
        },
      ],
    },
    {
      id: "outreach",
      label: "Outreach",
      groups: [
        {
          id: "constituent-outreach",
          label: "Outreach",
          commands: [
            { id: "send-email", label: "Send Email", href: "/communications" },
            { id: "generate-letter", label: "Generate Letter", href: "/oyama-letters" },
            { id: "create-task", label: "Create Task", href: "/tasks" },
            { id: "add-to-campaign", label: "Add to Campaign", href: "/campaigns" },
            { id: "log-interaction", label: "Log Interaction", href: "/meetings" },
          ],
        },
      ],
    },
    {
      id: "data",
      label: "Data",
      groups: [
        {
          id: "constituent-data",
          label: "Data",
          commands: [
            { id: "advanced-filter", label: "Advanced Filter" },
            { id: "saved-views", label: "Saved Views", disabledReason: "Saved views are not available on this page yet." },
            { id: "clear-filters", label: "Clear Filters" },
            { id: "export-constituents", label: "Export", disabledReason: "Constituent export is not wired on this grid yet." },
            { id: "column-manager", label: "Column Manager", disabledReason: "Column manager is not available on this table yet." },
          ],
        },
      ],
    },
    {
      id: "view",
      label: "View",
      groups: [
        {
          id: "constituent-view",
          label: "View",
          commands: [
            { id: "table-view", label: "Table View", active: () => true },
            { id: "card-view", label: "Card View", disabledReason: "Card view is not implemented for this table yet." },
            { id: "compact-rows", label: "Compact Rows", disabledReason: "Row density controls are not implemented yet." },
            { id: "group-by", label: "Group By", disabledReason: "Grouping is not implemented for this table yet." },
          ],
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      groups: [
        {
          id: "constituent-help",
          label: "Help",
          commands: [{ id: "open-help-constituents", label: "Help", href: "/help?scope=donor&scopePath=/constituents" }],
        },
      ],
    },
  ],
};

const DONOR_PROFILE_CONFIG: CrmRibbonPageConfig = {
  id: "donor-profile",
  pageLabel: "Donor Profile",
  defaultTabId: "profile",
  tabs: [
    {
      id: "profile",
      label: "Profile",
      groups: [
        {
          id: "profile-main",
          label: "Profile",
          commands: [
            { id: "edit-profile", label: "Edit Profile", disabledReason: "Profile editor is not connected for this view yet." },
            { id: "add-note", label: "Add Note", disabledReason: "Notes are not wired in this profile view yet." },
            { id: "add-tag", label: "Add Tag", disabledReason: "Tagging requires row or profile tagging support." },
            { id: "change-status", label: "Change Status", disabledReason: "Status change is not connected in this view yet." },
            { id: "assign-owner", label: "Assign Owner", disabledReason: "Owner assignment is not connected in this profile view yet." },
          ],
        },
      ],
    },
    {
      id: "profile-giving",
      label: "Giving",
      groups: [
        {
          id: "profile-giving-actions",
          label: "Giving",
          commands: [
            { id: "profile-add-gift", label: "Add Gift", href: "/donations?recordGift=1" },
            { id: "profile-gift-history", label: "Gift History", href: "/donations" },
            { id: "profile-create-receipt", label: "Create Receipt", disabledReason: "Receipt creation requires a selected receiptable gift." },
            { id: "profile-recurring-gift", label: "Recurring Gift", href: "/donations" },
            { id: "profile-pledge", label: "Pledge", disabledReason: "Pledge creation is not connected in this profile view yet." },
          ],
        },
      ],
    },
    {
      id: "profile-communication",
      label: "Communication",
      groups: [
        {
          id: "profile-comms-actions",
          label: "Communication",
          commands: [
            { id: "profile-send-email", label: "Send Email", href: "/communications" },
            { id: "profile-generate-letter", label: "Generate Letter", href: "/oyama-letters" },
            { id: "profile-log-call", label: "Log Call", href: "/meetings" },
            { id: "profile-send-text", label: "Send Text", disabledReason: "SMS delivery is not enabled for this workspace." },
            { id: "profile-view-timeline", label: "View Timeline", disabledReason: "Timeline view is not connected on this profile page yet." },
          ],
        },
      ],
    },
  ],
};

const DONATIONS_CONFIG: CrmRibbonPageConfig = {
  id: "donations",
  pageLabel: "Donations",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "donations-home",
          label: "Home",
          commands: [
            { id: "new-gift", label: "New Gift" },
            { id: "import-gifts", label: "Import Gifts", href: "/data-tools/import?target=donations" },
            { id: "find-gift", label: "Find Gift" },
            { id: "date-range-ytd", label: "YTD", active: (ctx) => ctx.flags?.allYears !== true },
            { id: "date-range-all-years", label: "All Years", active: (ctx) => ctx.flags?.allYears === true },
          ],
        },
      ],
    },
    {
      id: "gifts",
      label: "Gifts",
      groups: [
        {
          id: "gift-tools",
          label: "Gift Actions",
          commands: [
            { id: "edit-gift", label: "Edit Gift", requiredSelectionMin: 1, disabledReason: "Select a gift row to edit." },
            { id: "split-gift", label: "Split Gift", requiredSelectionMin: 1, disabledReason: "Select a gift row to split." },
            { id: "refund-void", label: "Refund/Void", requiredSelectionMin: 1, disabledReason: "Select a gift row to refund or void." },
            { id: "soft-credit", label: "Soft Credit", requiredSelectionMin: 1, disabledReason: "Select a gift row to add soft credit." },
            { id: "recurring-gift-tools", label: "Recurring Gift", href: "/donations" },
            { id: "pledge-payment", label: "Pledge Payment", disabledReason: "Pledge payment flow is not connected in this view yet." },
          ],
        },
      ],
    },
    {
      id: "receipts",
      label: "Receipts",
      groups: [
        {
          id: "receipt-tools",
          label: "Receipts",
          commands: [
            { id: "generate-receipt", label: "Generate Receipt", requiredSelectionMin: 1, disabledReason: "Select a receiptable gift to generate a receipt." },
            { id: "receipt-batch", label: "Receipt Batch", disabledReason: "Receipt batching is not connected on this page yet." },
            { id: "email-receipts", label: "Email Receipts", disabledReason: "Email receipt batch flow is not connected yet." },
            { id: "print-receipts", label: "Print Receipts", disabledReason: "Print receipt batch flow is not connected yet." },
            { id: "receipt-status-overview", label: "Receipt Status" },
          ],
        },
      ],
    },
    {
      id: "batches",
      label: "Batches",
      groups: [
        {
          id: "batch-tools",
          label: "Batches",
          commands: [
            { id: "create-batch", label: "Create Batch", disabledReason: "Batch creation is not connected in this view yet." },
            { id: "close-batch", label: "Close Batch", disabledReason: "Batch close is not connected in this view yet." },
            { id: "review-batch", label: "Review Batch", disabledReason: "Batch review is not connected in this view yet." },
            { id: "deposit-report", label: "Deposit Report", href: "/reports" },
          ],
        },
      ],
    },
    {
      id: "data",
      label: "Data",
      groups: [
        {
          id: "donations-data",
          label: "Data",
          commands: [
            { id: "filter-gifts", label: "Filter" },
            { id: "saved-views-gifts", label: "Saved Views", disabledReason: "Saved donation views are not available yet." },
            { id: "export-gifts", label: "Export", disabledReason: "Donation export is not connected in this view yet." },
            { id: "column-manager-gifts", label: "Column Manager", disabledReason: "Column manager is not available on this grid yet." },
          ],
        },
      ],
    },
    {
      id: "view",
      label: "View",
      groups: [
        {
          id: "donations-view",
          label: "View",
          commands: [{ id: "refresh-donations", label: "Refresh" }, { id: "clear-donation-filters", label: "Clear Filters" }],
        },
      ],
    },
  ],
};

const CAMPAIGNS_CONFIG: CrmRibbonPageConfig = {
  id: "campaigns",
  pageLabel: "Campaigns",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "campaign-home",
          label: "Campaigns",
          commands: [
            { id: "new-campaign", label: "New Campaign", href: "/campaigns/new" },
            { id: "open-campaign", label: "Open Campaign", href: "/campaigns" },
            { id: "duplicate-campaign", label: "Duplicate", disabledReason: "Select a campaign to duplicate." },
            { id: "archive-campaign", label: "Archive", disabledReason: "Select a campaign to archive." },
          ],
        },
      ],
    },
    {
      id: "campaign",
      label: "Campaign",
      groups: [
        {
          id: "campaign-tools",
          label: "Campaign",
          commands: [
            { id: "edit-campaign", label: "Edit Details" },
            { id: "set-goal", label: "Set Goal" },
            { id: "manage-funds", label: "Manage Funds" },
            { id: "campaign-timeline", label: "Timeline" },
            { id: "campaign-tasks", label: "Tasks", href: "/tasks" },
          ],
        },
      ],
    },
    {
      id: "view",
      label: "View",
      groups: [
        {
          id: "campaign-view",
          label: "View",
          commands: [
            { id: "all-campaigns", label: "All Campaigns", active: (ctx) => ctx.flags?.campaignFilter === "all" },
            { id: "active-campaigns", label: "Active", active: (ctx) => ctx.flags?.campaignFilter === "active" },
            { id: "inactive-campaigns", label: "Inactive", active: (ctx) => ctx.flags?.campaignFilter === "inactive" },
            { id: "this-year-campaigns", label: "This Year", active: (ctx) => ctx.flags?.campaignAllYears !== true },
            { id: "all-years-campaigns", label: "All Years", active: (ctx) => ctx.flags?.campaignAllYears === true },
            { id: "refresh-campaigns", label: "Refresh" },
          ],
        },
      ],
    },
    {
      id: "outreach",
      label: "Outreach",
      groups: [
        {
          id: "campaign-outreach",
          label: "Outreach",
          commands: [
            { id: "campaign-email-supporters", label: "Email Supporters", href: "/communications" },
            { id: "campaign-generate-letters", label: "Generate Letters", href: "/oyama-letters" },
            { id: "campaign-create-appeal", label: "Create Appeal", disabledReason: "Appeal builder is not wired yet." },
            { id: "campaign-social-post", label: "Social Post", disabledReason: "Social posting is not connected from this ribbon yet." },
          ],
        },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      groups: [
        {
          id: "campaign-reports",
          label: "Reports",
          commands: [
            { id: "campaign-performance", label: "Campaign Performance", href: "/reports" },
            { id: "donor-response", label: "Donor Response", href: "/reports" },
            { id: "campaign-export-report", label: "Export Report", disabledReason: "Campaign export is not connected in this view yet." },
          ],
        },
      ],
    },
  ],
};

const DATA_TOOLS_CONFIG: CrmRibbonPageConfig = {
  id: "data-tools",
  pageLabel: "Data Tools",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "data-tools-import",
          label: "Import",
          commands: [
            { id: "guided-import", label: "Guided Import", href: "/data-tools/import" },
            { id: "open-import-area", label: "Import Area" },
            { id: "open-import-history", label: "Import History" },
          ],
        },
        {
          id: "data-tools-export",
          label: "Export",
          commands: [
            { id: "export-constituents-data-tools", label: "Export Constituents" },
            { id: "export-donations-data-tools", label: "Export Donations" },
            { id: "export-campaigns-data-tools", label: "Export Campaigns" },
            { id: "export-designations-data-tools", label: "Export Designations" },
          ],
        },
      ],
    },
    {
      id: "quality",
      label: "Quality",
      groups: [
        {
          id: "data-tools-quality",
          label: "Quality",
          commands: [
            { id: "open-quality-metrics", label: "Quality Metrics" },
            { id: "open-merge-records", label: "Merge Records" },
            { id: "open-steward-paths-data-tools", label: "Steward Paths" },
          ],
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      groups: [
        {
          id: "data-tools-help",
          label: "Help",
          commands: [{ id: "open-help-data-tools", label: "Help", href: "/help?scope=donor&scopePath=/data-tools" }],
        },
      ],
    },
  ],
};

const OYAMA_EMAIL_CONFIG: CrmRibbonPageConfig = {
  id: "oyama-email",
  pageLabel: "OyamaEmail",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "email-home",
          label: "Email",
          commands: [
            { id: "new-email", label: "New Email" },
            { id: "new-newsletter", label: "New Newsletter" },
            { id: "open-drafts", label: "Open Drafts" },
            { id: "scheduled-sends", label: "Scheduled Sends" },
          ],
        },
      ],
    },
    {
      id: "compose",
      label: "Compose",
      groups: [
        {
          id: "email-compose",
          label: "Compose",
          commands: [
            { id: "subject", label: "Subject" },
            { id: "preview-text", label: "Preview Text" },
            { id: "design", label: "Design" },
            { id: "personalization", label: "Personalization" },
            { id: "test-email", label: "Test Email" },
            { id: "spam-check", label: "Spam Check" },
          ],
        },
      ],
    },
    {
      id: "analytics",
      label: "Analytics",
      groups: [
        {
          id: "email-analytics",
          label: "Analytics",
          commands: [
            { id: "email-opens", label: "Opens" },
            { id: "email-clicks", label: "Clicks" },
            { id: "email-bounces", label: "Bounces" },
            { id: "email-unsubscribes", label: "Unsubscribes" },
            { id: "email-export", label: "Export" },
          ],
        },
      ],
    },
  ],
};

const OYAMA_LETTERS_CONFIG: CrmRibbonPageConfig = {
  id: "oyama-letters",
  pageLabel: "OyamaLetters",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "letters-home",
          label: "Letters",
          commands: [
            { id: "new-letter", label: "New Letter" },
            { id: "open-template", label: "Open Template" },
            { id: "save-template", label: "Save Template" },
            { id: "duplicate-template", label: "Duplicate" },
          ],
        },
      ],
    },
    {
      id: "merge-fields",
      label: "Merge Fields",
      groups: [
        {
          id: "letters-merge",
          label: "Merge",
          commands: [
            { id: "insert-donor-field", label: "Donor Field" },
            { id: "insert-gift-field", label: "Gift Field" },
            { id: "insert-campaign-field", label: "Campaign Field" },
            { id: "validate-fields", label: "Validate Fields" },
          ],
        },
      ],
    },
    {
      id: "print-mail",
      label: "Print & Mail",
      groups: [
        {
          id: "letters-output",
          label: "Output",
          commands: [
            { id: "generate-pdf", label: "Generate PDF" },
            { id: "print-queue", label: "Print Queue", href: "/letters-printables" },
            { id: "mail-queue", label: "Mail Queue", disabledReason: "Mail queue is not connected from this ribbon yet." },
            { id: "letters-export", label: "Export" },
          ],
        },
      ],
    },
  ],
};

const STEWARD_PATHS_LIBRARY_CONFIG: CrmRibbonPageConfig = {
  id: "steward-paths-library",
  pageLabel: "Steward Paths Library",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "paths-library",
          label: "Library",
          commands: [
            { id: "create-path", label: "Create Path", href: "/steward-paths/new" },
            { id: "import-path", label: "Import Path", disabledReason: "Path import is not connected in this workspace yet." },
            { id: "use-template", label: "Use Template", href: "/steward-paths/library" },
            { id: "duplicate-path", label: "Duplicate", disabledReason: "Select a path to duplicate." },
            { id: "archive-path", label: "Archive", disabledReason: "Select a path to archive." },
          ],
        },
      ],
    },
    {
      id: "analytics",
      label: "Analytics",
      groups: [
        {
          id: "paths-analytics",
          label: "Analytics",
          commands: [
            { id: "view-activity", label: "Activity", href: "/steward-paths/activity" },
            { id: "view-analytics", label: "Analytics", href: "/steward-paths/analytics" },
          ],
        },
      ],
    },
  ],
};

const STEWARD_PATHS_BUILDER_CONFIG: CrmRibbonPageConfig = {
  id: "steward-paths-builder",
  pageLabel: "Path Builder",
  defaultTabId: "build",
  tabs: [
    {
      id: "build",
      label: "Build",
      groups: [
        {
          id: "builder-build",
          label: "Build",
          commands: [
            { id: "add-node", label: "Add Node" },
            { id: "connect-node", label: "Connect" },
            { id: "delete-node", label: "Delete" },
            { id: "undo-builder", label: "Undo" },
            { id: "redo-builder", label: "Redo" },
            { id: "auto-layout", label: "Auto Layout" },
          ],
        },
      ],
    },
    {
      id: "validate",
      label: "Validate",
      groups: [
        {
          id: "builder-validate",
          label: "Validate",
          commands: [
            { id: "run-validation", label: "Run Validation" },
            { id: "show-blockers", label: "Show Blockers" },
            { id: "show-warnings", label: "Show Warnings" },
          ],
        },
      ],
    },
    {
      id: "test",
      label: "Test",
      groups: [
        {
          id: "builder-test",
          label: "Test",
          commands: [
            { id: "open-playground", label: "Open Playground", href: "/steward-paths/livecom" },
            { id: "fake-donation", label: "Fake Donation" },
            { id: "test-email-builder", label: "Test Email" },
            { id: "step-through", label: "Step Through" },
            { id: "fast-forward", label: "Fast Forward" },
            { id: "reset-sandbox", label: "Reset Sandbox" },
          ],
        },
      ],
    },
    {
      id: "publish",
      label: "Publish",
      groups: [
        {
          id: "builder-publish",
          label: "Publish",
          commands: [
            { id: "review-changes", label: "Review Changes" },
            { id: "create-version", label: "Create Version" },
            { id: "publish-path", label: "Publish", enabled: (ctx) => ctx.flags?.hasValidationBlockers !== true, disabledReason: "Resolve validation blockers before publishing." },
            { id: "pause-path", label: "Pause Path" },
            { id: "archive-path-builder", label: "Archive" },
          ],
        },
      ],
    },
  ],
};

const STEWARD_PATHS_PLAYGROUND_CONFIG: CrmRibbonPageConfig = {
  id: "steward-paths-playground",
  pageLabel: "Path Playground",
  defaultTabId: "scenario",
  tabs: [
    {
      id: "scenario",
      label: "Scenario",
      groups: [
        {
          id: "playground-scenario",
          label: "Scenario",
          commands: [
            { id: "fake-donation-playground", label: "Fake Donation" },
            { id: "fake-event-playground", label: "Fake Event" },
            { id: "manual-enrollment", label: "Manual Enrollment" },
            { id: "email-open-click", label: "Email Open/Click" },
          ],
        },
      ],
    },
    {
      id: "playback",
      label: "Playback",
      groups: [
        {
          id: "playground-controls",
          label: "Playback",
          commands: [
            { id: "play", label: "Play" },
            { id: "pause", label: "Pause" },
            { id: "step", label: "Step" },
            { id: "fast-forward-playground", label: "Fast Forward" },
            { id: "reset-playground", label: "Reset" },
          ],
        },
      ],
    },
  ],
};

const TASKS_CONFIG: CrmRibbonPageConfig = {
  id: "tasks",
  pageLabel: "Tasks",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "tasks-home",
          label: "Queues",
          commands: [
            { id: "task-queue-my", label: "My Work", active: (ctx) => ctx.flags?.focusMode === "my" },
            { id: "task-queue-team", label: "Team Queue", active: (ctx) => ctx.flags?.focusMode === "team" },
            { id: "task-queue-followups", label: "Follow-Ups", active: (ctx) => ctx.flags?.focusMode === "followups" },
            { id: "task-new", label: "New Task" },
          ],
        },
      ],
    },
    {
      id: "view",
      label: "View",
      groups: [
        {
          id: "tasks-view",
          label: "View",
          commands: [
            { id: "task-refresh", label: "Refresh" },
            { id: "task-refresh-notifications", label: "Refresh Alerts" },
            { id: "task-reset-filters", label: "Reset Filters" },
          ],
        },
      ],
    },
  ],
};

const MEETINGS_CONFIG: CrmRibbonPageConfig = {
  id: "meetings",
  pageLabel: "Meetings",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "meetings-home",
          label: "Meetings",
          commands: [
            { id: "meeting-schedule", label: "Schedule Meeting" },
            { id: "meeting-view-all", label: "All", active: (ctx) => !ctx.flags?.meetingStatus },
            { id: "meeting-view-scheduled", label: "Scheduled", active: (ctx) => ctx.flags?.meetingStatus === "SCHEDULED" },
            { id: "meeting-view-followup", label: "Follow-Up", active: (ctx) => ctx.flags?.meetingStatus === "NEEDS_FOLLOW_UP" },
            { id: "meeting-refresh", label: "Refresh" },
          ],
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      groups: [
        {
          id: "meetings-help",
          label: "Help",
          commands: [{ id: "open-help-meetings", label: "Help", href: "/help?scope=donor&scopePath=/meetings" }],
        },
      ],
    },
  ],
};

const FALLBACK_CONFIG: CrmRibbonPageConfig = {
  id: "generic",
  pageLabel: "Workspace",
  defaultTabId: "home",
  tabs: [
    {
      id: "home",
      label: "Home",
      groups: [
        {
          id: "workspace-core",
          label: "Workspace",
          commands: [
            { id: "workspace-refresh", label: "Refresh" },
            { id: "workspace-help", label: "Help", href: "/help" },
          ],
        },
      ],
    },
  ],
};

function isConstituentProfilePath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments[0] === "constituents" && segments.length === 2 && segments[1] !== "new";
}

export function resolveCrmRibbonConfig(pathname: string): CrmRibbonPageConfig {
  if (pathname === "/" || pathname === "/dashboard") return DASHBOARD_CONFIG;
  if (pathname.startsWith("/constituents") && !isConstituentProfilePath(pathname)) return CONSTITUENTS_CONFIG;
  if (isConstituentProfilePath(pathname)) return DONOR_PROFILE_CONFIG;
  if (pathname.startsWith("/donations")) return DONATIONS_CONFIG;
  if (pathname.startsWith("/campaigns")) return CAMPAIGNS_CONFIG;
  if (pathname.startsWith("/data-tools")) return DATA_TOOLS_CONFIG;
  if (pathname.startsWith("/oyama-email")) return OYAMA_EMAIL_CONFIG;
  if (pathname.startsWith("/oyama-letters")) return OYAMA_LETTERS_CONFIG;
  if (pathname.startsWith("/steward-paths/builder")) return STEWARD_PATHS_BUILDER_CONFIG;
  if (pathname.startsWith("/steward-paths/livecom")) return STEWARD_PATHS_PLAYGROUND_CONFIG;
  if (pathname.startsWith("/steward-paths")) return STEWARD_PATHS_LIBRARY_CONFIG;
  if (pathname.startsWith("/tasks")) return TASKS_CONFIG;
  if (pathname.startsWith("/meetings")) return MEETINGS_CONFIG;
  return FALLBACK_CONFIG;
}
