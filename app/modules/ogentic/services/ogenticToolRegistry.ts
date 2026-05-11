/** OGentic tool registry defines controlled AI tool metadata and safe execution stubs. */

import type { OGenticExecutionContext, OGenticTool } from "@/app/modules/ogentic/types/ogentic.types";

/** Builds a stub executor that clearly reports unimplemented behavior. */
function buildStubExecutor(toolId: string) {
  return async (input: unknown, context: OGenticExecutionContext): Promise<unknown> => {
    void input;
    void context;
    return {
      status: "stub",
      toolId,
      message: "Tool is not fully wired yet. // TODO: backend API needed",
      timestamp: new Date().toISOString(),
    };
  };
}

/** OGENTIC_TOOL_REGISTRY is the initial controlled tool list with risk levels and approval boundaries. */
export const OGENTIC_TOOL_REGISTRY: OGenticTool[] = [
  {
    id: "donor.searchDonors",
    name: "Search Donors",
    description: "Find donor records by name, email, tags, or giving traits.",
    category: "donor",
    riskLevel: "safe",
    requiresApproval: false,
    isStub: true,
    inputSchema: { query: "string" },
    outputSchema: { donors: "array" },
    execute: buildStubExecutor("donor.searchDonors"),
  },
  {
    id: "donor.findLapsedDonors",
    name: "Find Lapsed Donors",
    description: "Identify donors who gave last year but have not given this year.",
    category: "analysis",
    riskLevel: "safe",
    requiresApproval: false,
    isStub: true,
    inputSchema: { compareYears: "number[]" },
    outputSchema: { donors: "array", summary: "object" },
    execute: buildStubExecutor("donor.findLapsedDonors"),
  },
  {
    id: "communication.draftEmail",
    name: "Draft Email",
    description: "Generate donor communications as drafts without sending.",
    category: "communication",
    riskLevel: "safe",
    requiresApproval: false,
    isStub: true,
    inputSchema: { purpose: "string", audience: "string" },
    outputSchema: { draft: "object" },
    execute: buildStubExecutor("communication.draftEmail"),
  },
  {
    id: "communication.saveEmailDraft",
    name: "Save Email Draft",
    description: "Persist an email draft artifact for review.",
    category: "communication",
    riskLevel: "review_required",
    requiresApproval: true,
    isStub: true,
    inputSchema: { draftId: "string" },
    outputSchema: { saved: "boolean" },
    execute: buildStubExecutor("communication.saveEmailDraft"),
  },
  {
    id: "spreadsheet.createSpreadsheetView",
    name: "Create Spreadsheet View",
    description: "Create a saved donor/event spreadsheet-like analysis view.",
    category: "spreadsheet",
    riskLevel: "safe",
    requiresApproval: false,
    isStub: true,
    inputSchema: { title: "string", columns: "array" },
    outputSchema: { spreadsheet: "object" },
    execute: buildStubExecutor("spreadsheet.createSpreadsheetView"),
  },
  {
    id: "task.createTaskList",
    name: "Create Task Plan",
    description: "Build a stewardship follow-up plan with task recommendations.",
    category: "task",
    riskLevel: "review_required",
    requiresApproval: true,
    isStub: true,
    inputSchema: { campaignId: "string" },
    outputSchema: { tasks: "array" },
    execute: buildStubExecutor("task.createTaskList"),
  },
  {
    id: "system.exportDonorData",
    name: "Export Donor Data",
    description: "Export donor data with explicit user approval and permission checks.",
    category: "export",
    riskLevel: "sensitive",
    requiresApproval: true,
    isStub: true,
    inputSchema: { segmentId: "string" },
    outputSchema: { exportId: "string" },
    execute: buildStubExecutor("system.exportDonorData"),
  },
];

/** Returns all tools or only tools in one category. */
export function listOGenticTools(category?: OGenticTool["category"]): OGenticTool[] {
  if (!category) return OGENTIC_TOOL_REGISTRY;
  return OGENTIC_TOOL_REGISTRY.filter((tool) => tool.category === category);
}
