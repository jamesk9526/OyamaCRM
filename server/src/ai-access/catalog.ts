/** The allowlist for AI data, actions, schemas, settings labels and audit names.
 * Never infer a resource or a writable field from a client-provided Prisma name.
 */
import { Prisma } from "@prisma/client";
import type { PermissionKey } from "../lib/permissions.js";

export type AccessMode = "blocked" | "approval" | "automatic";
export type FieldGroup = "basic" | "contact" | "birthDate" | "giving" | "notes" | "content" | "attachments";
export type NativeRouter = "constituents" | "donations" | "campaigns" | "tasks" | "meetings" | "events" | "grants" | "households" | "email" | "paths" | "create" | "webmaster" | "qr" | "customReports";
export type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; required?: string[]; additionalProperties?: boolean; enum?: readonly (string | number | boolean)[]; items?: JsonSchema; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; maxItems?: number; description?: string; anyOf?: JsonSchema[] };
export type AiResource = {
  key: string; title: string; module: string; model: string; path: string;
  permission: PermissionKey; fields: string[]; search: string[];
  scope: "organization" | "constituent" | "event" | "grant" | "path" | "list" | "activity" | "customValue" | "savedReport";
  owner?: string; campaign?: string; event?: string; extra?: Record<string, unknown>;
};
const resource = (key: string, title: string, module: string, model: string, path: string, permission: PermissionKey, fields: string, search: string, scope: AiResource["scope"] = "organization", options: Partial<AiResource> = {}): AiResource => ({ key, title, module, model, path, permission, fields: ["id", ...fields.split(" ").filter(Boolean), "createdAt", "updatedAt"], search: search.split(" ").filter(Boolean), scope, ...options });
export const RESOURCES: AiResource[] = [
  resource("constituents", "People and organizations", "People", "Constituent", "/constituents/:id", "view:constituents", "type donorStatus prefix firstName lastName displayName organizationName contactFirstName contactLastName contactTitle entityKind organizationCategory email email2 phone phone2 mobile addressLine1 addressLine2 city state zip country birthDate employer occupation notes householdId isPrimaryContact doNotEmail doNotCall doNotMail doNotContact emailOptOut", "firstName lastName displayName organizationName email phone notes", "organization", { extra: { closedAt: null } }),
  resource("households", "Households", "People", "Household", "/constituents", "view:constituents", "name headConstituentId addressLine1 addressLine2 city state zip country", "name"),
  resource("groups", "Relationship groups", "People", "ConstituentGroup", "/constituents", "view:constituents", "name groupType description primaryConstituentId", "name description"),
  resource("tags", "Tags", "People", "Tag", "/constituents", "view:constituents", "name color description", "name description"),
  resource("gifts", "Gifts and receipts", "Giving", "Donation", "/donations", "view:donations", "constituentId campaignId designationId pledgeId eventId amount feeAmount date paymentMethod status checkNumber isRecurring frequency nextGiftDate receiptNumber receiptSentAt acknowledgmentSentAt taxDeductible taxDeductibleAmount taxDeductibleNotes taxReceiptRequested inKindDescription notes", "receiptNumber inKindDescription notes", "constituent", { campaign: "campaignId", event: "eventId" }),
  resource("pledges", "Pledges", "Giving", "Pledge", "/constituents", "view:donations", "constituentId campaignId designationId totalAmount paidAmount startDate endDate frequency notes active", "notes", "constituent", { campaign: "campaignId" }),
  resource("funds", "Funds and designations", "Giving", "Designation", "/donations", "view:donations", "name description active", "name description"),
  resource("campaigns", "Fundraising campaigns", "Fundraising", "Campaign", "/campaigns/:id", "view:campaigns", "name description category goal startDate endDate active", "name description"),
  resource("tasks", "Tasks", "Operations", "Task", "/tasks", "view:tasks", "title description constituentId assigneeId createdById type status priority dueDate reminderAt snoozedUntil archivedAt completedAt outcome sourceModule sourceType sourceId meetingId", "title description outcome", "organization", { owner: "assigneeId" }),
  resource("meetings", "Meetings", "Operations", "Meeting", "/meetings", "view:tasks", "title type status startTime endTime timezone locationType location meetingUrl purpose notes privateNotes outcome followUpNeeded constituentId assignedStaffId createdById completedAt canceledAt", "title purpose notes", "organization", { owner: "assignedStaffId" }),
  resource("events", "Events", "Events", "Event", "/events/:id", "view:events", "name description type status visibility location address city state zip virtualUrl startDate endDate registrationDeadline capacity registrationGoal revenueGoal ownerId internalNotes active", "name description location internalNotes", "organization", { owner: "ownerId" }),
  resource("event_guests", "Event guests", "Events", "EventGuest", "/events/:eventId/guests", "view:events", "eventId constituentId orderId firstName lastName email phone rsvpStatus paymentStatus source notes", "firstName lastName email notes", "event", { event: "eventId" }),
  resource("event_orders", "Event orders", "Events", "EventOrder", "/events/:eventId/orders", "view:events", "eventId constituentId orderNumber status totalAmount feeAmount paymentMethod paidAt notes", "orderNumber notes", "event", { event: "eventId" }),
  resource("event_tables", "Tables and hosts", "Events", "EventTable", "/events/:eventId/tables", "view:events", "eventId name capacity status notes tableNumber isSponsored sponsorName hostName hostEmail hostPhone xPosition yPosition shape", "name sponsorName hostName notes", "event", { event: "eventId" }),
  resource("event_seats", "Event seats", "Events", "EventTableSeat", "/events/:eventId/tables", "view:events", "eventId tableId seatNumber status notes", "notes", "event", { event: "eventId" }),
  resource("sponsors", "Sponsorships", "Events", "EventSponsor", "/events/:eventId/sponsors", "view:events", "eventId constituentId level amount benefits logoUrl websiteUrl notes", "benefits notes", "event", { event: "eventId" }),
  resource("attendance", "Attendance", "Events", "EventAttendance", "/events/:eventId/check-in", "view:events", "eventId constituentId checkedInAt checkedOutAt notes", "notes", "event", { event: "eventId" }),
  resource("volunteer_hours", "Volunteer hours", "Events", "VolunteerHour", "/volunteers", "view:constituents", "constituentId eventId hours description date", "description", "constituent", { event: "eventId" }),
  resource("grants", "Grants", "Fundraising", "Grant", "/grants/:id", "grants.view", "funderId assigneeId title programArea status amountRequested amountAwarded requiresLOI loiDeadline loiSubmittedAt applicationDeadline submittedAt awardedAt rejectedAt grantPeriodStart grantPeriodEnd reportingDeadline reportingSubmittedAt notes internalNotes", "title programArea notes internalNotes", "organization", { owner: "assigneeId" }),
  resource("funders", "Grant funders", "Fundraising", "GrantFunder", "/grants", "grants.view", "name type website contactName contactEmail contactPhone notes", "name contactName notes"),
  resource("grant_sections", "Grant sections", "Fundraising", "GrantSection", "/grants/:grantId", "grants.view", "grantId key title content wordLimit sortOrder completed", "title content", "grant"),
  resource("grant_activities", "Grant history", "Fundraising", "GrantActivity", "/grants/:grantId", "grants.view", "grantId userId type description", "description", "grant"),
  resource("email", "Email campaigns", "Communications", "EmailCampaign", "/oyama-email/campaigns/:id", "view:communications", "name subject purpose previewText fromName fromEmail replyToEmail bodyHtml bodyText status scheduledAt sentAt totalRecipients delivered opened clicked bounced unsubscribed", "name subject bodyText"),
  resource("audiences", "Audience lists", "Communications", "EmailRecipientList", "/oyama-email/lists", "view:communications", "name description createdById", "name description", "organization", { owner: "createdById" }),
  resource("email_delivery", "Email delivery history", "Communications", "EmailSendRecipient", "/oyama-email/campaigns/:campaignId", "view:communications", "campaignId constituentId email purpose eligibilityStatus ineligibilityReason queuedAt sentAt", "email ineligibilityReason", "organization", { campaign: "campaignId" }),
  resource("email_preferences", "Email preferences", "Communications", "EmailSubscription", "/communications", "view:communications", "constituentId email globalStatus source subscribedAt unsubscribedAt confirmedAt", "email"),
  resource("letters", "Letter templates", "Communications", "LetterTemplate", "/oyama-letters/templates/:id", "letters.view", "name category status revision printSubject printBody documentJson", "name printSubject printBody", "organization", { extra: { crmScope: "DONOR", status: { not: "ARCHIVED" } } }),
  resource("create_campaigns", "Create campaigns", "Communications", "CreateCampaign", "/oyama-create/campaigns/:id", "view:communications", "name objective status ownerId fundraisingCampaignId eventId revision startsAt endsAt channelsJson deliveryMode", "name objective", "organization", { owner: "ownerId", campaign: "fundraisingCampaignId", event: "eventId" }),
  resource("paths", "Steward Paths", "Stewardship", "StewardPath", "/steward-paths/:id", "steward_paths.view", "name description status targetType defaultOwnerId sharedWithOrganization", "name description", "organization", { owner: "defaultOwnerId", extra: { crmScope: "DONOR" } }),
  resource("path_enrollments", "Path enrollments", "Stewardship", "StewardPathEnrollment", "/steward-paths/:pathId", "steward_paths.view", "pathId constituentId ownerUserId status currentStepId startedAt completedAt pausedAt pausedReason", "pausedReason", "organization", { owner: "ownerUserId" }),
  resource("path_steps", "Path steps", "Stewardship", "StewardPathStep", "/steward-paths/:pathId", "steward_paths.view", "pathId stepType name description orderIndex isRequired isActive", "name description", "path"),
  resource("path_runs", "Path execution history", "Stewardship", "StewardPathStepRun", "/steward-paths/activity", "steward_paths.view", "enrollmentId stepId status scheduledFor startedAt completedAt errorMessage", "", "path"),
  resource("websites", "Websites", "Web", "WebmasterSite", "/webmaster", "view:communications", "name slug domain description status createdById", "name description", "organization", { owner: "createdById" }),
  resource("web_pages", "Website pages", "Web", "WebmasterPage", "/webmaster", "view:communications", "siteId title slug path status contentJson seoTitle seoDescription publishedAt createdById", "title seoDescription", "organization", { owner: "createdById" }),
  resource("qr_links", "QR links", "Web", "QrCodeLink", "/qr-codes", "view:communications", "name slug destinationUrl notes active expiresAt createdById", "name notes", "organization", { owner: "createdById" }),
  resource("documents", "Your context documents", "Operations", "AiContextFile", "/settings/ai", "view:constituents", "fileName displayName mimeType fileType sizeBytes workspaceScope description indexingStatus active extractedText indexedAt userId", "displayName description extractedText", "organization", { owner: "userId", extra: { active: true } }),
  resource("staff", "Staff directory", "Operations", "User", "/settings/users", "view:tasks", "firstName lastName email role active", "firstName lastName email", "organization", { extra: { active: true } }),
  resource("business_settings", "Business settings", "Operations", "OrganizationSettings", "/settings/organization", "view:constituents", "organizationName currency timezone fiscalYearStart website mission address phone", ""),
  resource("custom_fields", "Custom field definitions", "People", "CustomField", "/settings/custom-fields", "view:custom_fields", "name key label entityType fieldType options required active sortOrder", "name label key"),
  resource("custom_values", "Custom field values", "People", "CustomFieldValue", "/constituents", "view:custom_fields", "fieldId entityId entityType value valueString valueNumber valueBoolean valueDate", "", "customValue"),
  resource("activities", "Record timeline", "Operations", "Activity", "/constituents", "view:constituents", "constituentId donationId taskId meetingId eventId userId type description", "description", "activity"),
  resource("saved_reports", "Your saved reports", "Analytics", "PluginSetting", "/reports", "view:reports", "config", "", "savedReport"),
  resource("import_history", "Create import history", "Data tools", "CreateImportRun", "/data-tools", "import:data", "status scanned lastError nextScanAt", ""),
];

const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
export function modelFields(res: AiResource) { return models.get(res.model)?.fields.filter(field => field.kind !== "object" && !field.isList && res.fields.includes(field.name)) || []; }
// Missing legacy fields are not silently selected; generated model metadata is authoritative.
export function resourceFields(res: AiResource) { return modelFields(res).map(field => field.name); }
export function fieldGroup(name: string): FieldGroup {
  if (/birthDate/i.test(name)) return "birthDate";
  if (/email|phone|mobile|address|zip|country|^city$|^state$|contactName|hostName|meetingUrl/i.test(name)) return "contact";
  if (/amount|giving|deductib|receipt|paidAmount|totalAmount|feeAmount|checkNumber/i.test(name)) return "giving";
  if (/notes|description|outcome|purpose|error|reason/i.test(name)) return "notes";
  if (/body|content|documentJson|extractedText|config/i.test(name)) return "content";
  if (/logoUrl|avatarUrl/i.test(name)) return "attachments";
  return "basic";
}
export function fieldSchema(res: AiResource, name: string): JsonSchema {
  const field = modelFields(res).find(item => item.name === name);
  if (!field) throw new Error(`Unknown AI field ${res.key}.${name}`);
  const values = Prisma.dmmf.datamodel.enums.find(item => item.name === field.type)?.values.map(item => item.name);
  if (values) return { type: "string", enum: values };
  if (field.type === "Boolean") return { type: "boolean" };
  if (["Int", "Float", "Decimal"].includes(field.type)) return { type: field.type === "Int" ? "integer" : "number", minimum: -1_000_000_000, maximum: 1_000_000_000 };
  if (field.type === "Json") return { type: "object", description: "Structured module document; validated by its native CRM service." };
  return { type: "string", maxLength: field.type === "DateTime" ? 40 : ["bodyHtml", "bodyText", "content", "extractedText"].includes(name) ? 100000 : 10000 };
}

export type AiCapability = {
  key: string; title: string; module: string; resource?: string; read: boolean;
  permissions: PermissionKey[]; risk: "routine" | "consequential";
  fields?: string[]; required?: string[];
  native?: { router: NativeRouter; method: "POST" | "PUT" | "PATCH" | "DELETE"; path: string };
  handler?: "record" | "note" | "fund" | "pledge" | "volunteer" | "custom" | "export" | "analytics";
};
const readCapabilities: AiCapability[] = RESOURCES.flatMap(res => {
  const groups = [...new Set(resourceFields(res).map(fieldGroup))].filter(group => group !== "basic");
  return [{ key: `${res.key}.read`, title: `Read ${res.title.toLowerCase()}`, module: res.module, resource: res.key, read: true, permissions: [res.permission], risk: "routine" as const },
    ...groups.map(group => ({ key: `${res.key}.${group}.read`, title: `Read ${group === "birthDate" ? "birth dates" : group}`, module: res.module, resource: res.key, read: true, permissions: [res.permission], risk: "routine" as const }))];
});
const action = (key: string, title: string, resKey: string, permission: PermissionKey, method: "POST" | "PUT" | "PATCH" | "DELETE", router: NativeRouter, path: string, fields: string, required: string[] = [], risk: AiCapability["risk"] = "routine"): AiCapability => ({ key, title, resource: resKey, module: RESOURCES.find(res => res.key === resKey)!.module, read: false, permissions: [permission], risk, fields: fields.split(" ").filter(Boolean), required, native: { method, router, path } });
export const WRITE_CAPABILITIES: AiCapability[] = [
  action("constituents.create", "Create a person or organization", "constituents", "edit:constituents", "POST", "constituents", "/", "firstName lastName displayName organizationName type donorStatus entityKind email phone mobile addressLine1 addressLine2 city state zip country employer occupation notes doNotEmail doNotCall doNotMail doNotContact", ["firstName", "lastName"]),
  action("constituents.update", "Update a person or organization", "constituents", "edit:constituents", "PUT", "constituents", "/:id", "firstName lastName displayName organizationName prefix email email2 phone phone2 mobile addressLine1 addressLine2 city state zip country birthDate employer occupation notes type donorStatus doNotEmail doNotCall doNotMail doNotContact emailOptOut"),
  action("constituents.close", "Close a constituent account", "constituents", "edit:constituents", "POST", "constituents", "/:id/close", "reason", ["reason"], "consequential"),
  action("constituents.merge", "Merge constituent records", "constituents", "delete:constituents", "POST", "constituents", "/merge", "keepId mergeId", ["keepId", "mergeId"], "consequential"),
  action("constituents.delete", "Delete a constituent", "constituents", "delete:constituents", "DELETE", "constituents", "/:id", "", [], "consequential"),
  { key: "constituents.notes.append", title: "Append a donor note", module: "People", resource: "constituents", read: false, permissions: ["edit:constituents"], risk: "routine", fields: ["note"], required: ["note"], handler: "note" },
  action("constituents.activity.create", "Log an interaction", "constituents", "edit:constituents", "POST", "constituents", "/:id/activities", "type description", ["type", "description"]),
  action("households.update", "Update a household", "households", "edit:constituents", "PUT", "households", "/:id", "name addressLine1 addressLine2 city state zip country"),
  action("gifts.create", "Record a gift", "gifts", "edit:donations", "POST", "donations", "/", "constituentId campaignId designationId pledgeId eventId amount date paymentMethod status checkNumber isRecurring frequency nextGiftDate taxDeductible taxDeductibleAmount taxDeductibleNotes taxReceiptRequested inKindDescription notes", ["constituentId", "amount", "date"], "consequential"),
  action("gifts.update", "Correct a gift", "gifts", "edit:donations", "PUT", "donations", "/:id", "constituentId campaignId designationId pledgeId eventId amount date paymentMethod status checkNumber isRecurring frequency taxDeductible taxDeductibleAmount taxDeductibleNotes taxReceiptRequested inKindDescription notes", [], "consequential"),
  action("gifts.delete", "Delete a gift", "gifts", "delete:donations", "DELETE", "donations", "/:id", "", [], "consequential"),
  action("gifts.acknowledgment.update", "Update acknowledgment status", "gifts", "edit:donations", "PATCH", "donations", "/:id/acknowledgment", "acknowledged", ["acknowledged"]),
  action("campaigns.create", "Create a fundraising campaign", "campaigns", "edit:campaigns", "POST", "campaigns", "/", "name description category goal startDate endDate active", ["name", "startDate"]),
  action("campaigns.update", "Update a fundraising campaign", "campaigns", "edit:campaigns", "PATCH", "campaigns", "/:id", "name description category goal startDate endDate active"),
  action("campaigns.delete", "Delete a fundraising campaign", "campaigns", "edit:campaigns", "DELETE", "campaigns", "/:id", "", [], "consequential"),
  action("tasks.create", "Create and assign a task", "tasks", "edit:tasks", "POST", "tasks", "/", "title description constituentId assigneeId type priority dueDate reminderAt", ["title"]),
  action("tasks.update", "Update or complete a task", "tasks", "edit:tasks", "PATCH", "tasks", "/:id", "title description assigneeId type status priority dueDate reminderAt outcome"),
  action("tasks.delete", "Delete a task", "tasks", "edit:tasks", "DELETE", "tasks", "/:id", "", [], "consequential"),
  action("meetings.create", "Schedule a meeting", "meetings", "edit:tasks", "POST", "meetings", "/", "title type startTime endTime timezone locationType location meetingUrl purpose notes privateNotes constituentId assignedStaffId", ["title", "startTime"]),
  action("meetings.update", "Update a meeting", "meetings", "edit:tasks", "PATCH", "meetings", "/:id", "title type startTime endTime timezone locationType location meetingUrl purpose notes privateNotes outcome followUpNeeded assignedStaffId"),
  action("meetings.complete", "Complete a meeting", "meetings", "edit:tasks", "POST", "meetings", "/:id/complete", "outcome notes followUpNeeded"),
  action("meetings.cancel", "Cancel a meeting", "meetings", "edit:tasks", "POST", "meetings", "/:id/cancel", "outcome"),
  action("events.create", "Create an event", "events", "edit:events", "POST", "events", "/", "name description type status visibility location address city state zip virtualUrl startDate endDate registrationDeadline capacity registrationGoal revenueGoal internalNotes", ["name", "startDate"]),
  action("events.update", "Update an event", "events", "edit:events", "PATCH", "events", "/:id", "name description type status visibility location address city state zip virtualUrl startDate endDate registrationDeadline capacity registrationGoal revenueGoal internalNotes"),
  action("event_guests.create", "Register an event guest", "event_guests", "edit:events", "POST", "events", "/:eventId/guests", "firstName lastName email phone constituentId rsvpStatus paymentStatus notes", ["firstName", "lastName"]),
  action("event_guests.update", "Update an event guest", "event_guests", "edit:events", "PATCH", "events", "/guests/:id", "firstName lastName email phone rsvpStatus notes"),
  action("event_guests.checkin", "Check in an event guest", "event_guests", "edit:events", "POST", "events", "/:eventId/checkin/guest/:id", ""),
  action("event_guests.reverse_checkin", "Reverse a guest check-in", "event_guests", "edit:events", "POST", "events", "/:eventId/checkin/guest/:id/reverse", "reason"),
  action("event_tables.create", "Create an event table", "event_tables", "edit:events", "POST", "events", "/:eventId/tables", "name capacity tableNumber notes hostName hostEmail hostPhone", ["name", "capacity"]),
  action("event_tables.update", "Update an event table", "event_tables", "edit:events", "PATCH", "events", "/tables/:id", "name capacity tableNumber notes hostName hostEmail hostPhone xPosition yPosition shape"),
  action("grants.create", "Create a grant", "grants", "grants.create", "POST", "grants", "/", "title funderId assigneeId programArea status amountRequested amountAwarded requiresLOI loiDeadline applicationDeadline grantPeriodStart grantPeriodEnd reportingDeadline notes internalNotes", ["title", "funderId"]),
  action("grants.update", "Update a grant", "grants", "grants.edit", "PATCH", "grants", "/:id", "title funderId assigneeId programArea status amountRequested amountAwarded requiresLOI loiDeadline loiSubmittedAt applicationDeadline submittedAt awardedAt rejectedAt grantPeriodStart grantPeriodEnd reportingDeadline reportingSubmittedAt notes internalNotes"),
  action("grants.delete", "Delete a grant", "grants", "grants.delete", "DELETE", "grants", "/:id", "", [], "consequential"),
  action("funders.create", "Create a grant funder", "funders", "grants.manage_funders", "POST", "grants", "/funders", "name type website contactName contactEmail contactPhone notes", ["name"]),
  action("funders.update", "Update a grant funder", "funders", "grants.manage_funders", "PATCH", "grants", "/funders/:id", "name type website contactName contactEmail contactPhone notes"),
  action("grant_sections.update", "Write a grant section", "grant_sections", "grants.edit", "PATCH", "grants", "/:grantId/sections/:key", "content completed wordLimit"),
  action("grant_activities.create", "Log grant activity", "grant_activities", "grants.edit", "POST", "grants", "/:grantId/activity", "type description", ["type", "description"]),
  action("email.draft.create", "Create an email draft", "email", "edit:communications", "POST", "email", "/", "name subject purpose previewText fromName fromEmail replyToEmail bodyHtml bodyText", ["name", "subject"]),
  action("email.draft.update", "Edit an email draft", "email", "edit:communications", "PUT", "email", "/:id", "name subject purpose previewText fromName fromEmail replyToEmail bodyHtml bodyText"),
  action("email.send", "Send an email campaign", "email", "edit:communications", "POST", "email", "/:id/send", "sendMode recipientEmails", [], "consequential"),
  action("paths.create", "Create a Steward Path", "paths", "steward_paths.create", "POST", "paths", "/templates", "name description targetType defaultOwnerId", ["name"]),
  action("paths.update", "Update a Steward Path", "paths", "steward_paths.edit", "PATCH", "paths", "/templates/:id", "name description defaultOwnerId"),
  action("path_enrollments.create", "Enroll a constituent in a path", "path_enrollments", "steward_paths.enroll", "POST", "paths", "/templates/:pathId/enrollments", "constituentId ownerUserId", ["constituentId"], "consequential"),
  action("path_enrollments.pause", "Pause a path enrollment", "path_enrollments", "steward_paths.pause", "PATCH", "paths", "/enrollments/:id/status", "status reason", ["status"], "consequential"),
  action("qr_links.create", "Create a QR link", "qr_links", "edit:communications", "POST", "qr", "/", "name slug destinationUrl notes active expiresAt", ["name", "destinationUrl"]),
  action("qr_links.update", "Update a QR link", "qr_links", "edit:communications", "PATCH", "qr", "/:id", "name slug destinationUrl notes active expiresAt"),
  action("web_pages.update", "Edit a website page", "web_pages", "edit:communications", "PATCH", "webmaster", "/pages/:id", "title slug path contentJson seoTitle seoDescription"),
  action("websites.publish", "Publish a website", "websites", "edit:communications", "POST", "webmaster", "/sites/:id/publish", "", [], "consequential"),
  action("saved_reports.create", "Save a custom report", "saved_reports", "view:reports", "POST", "customReports", "/", "name source from through columns filters sort", ["name", "source"]),
  ...["funds", "pledges", "volunteer_hours"].flatMap(key => ["create", "update"].map(verb => ({ key: `${key}.${verb}`, title: `${verb === "create" ? "Create" : "Update"} ${RESOURCES.find(res => res.key === key)!.title.toLowerCase()}`, module: RESOURCES.find(res => res.key === key)!.module, resource: key, read: false, permissions: [key === "volunteer_hours" ? "edit:constituents" : "edit:donations"] as PermissionKey[], risk: key === "volunteer_hours" ? "routine" as const : "consequential" as const, fields: resourceFields(RESOURCES.find(res => res.key === key)!).filter(field => !["id", "createdAt", "updatedAt", "paidAmount"].includes(field)), handler: key === "funds" ? "fund" as const : key === "pledges" ? "pledge" as const : "volunteer" as const }))),
  { key: "custom_values.update", title: "Update a custom field value", module: "People", resource: "custom_values", read: false, permissions: ["edit:constituents", "view:custom_fields"], risk: "routine", fields: ["fieldId", "entityId", "entityType", "value"], required: ["fieldId", "entityId", "entityType"], handler: "custom" },
  { key: "records.export", title: "Export accessible records", module: "Data tools", read: false, permissions: ["export:data"], risk: "consequential", handler: "export" },
];
export const CAPABILITIES: AiCapability[] = [
  ...readCapabilities, ...WRITE_CAPABILITIES,
  { key: "crm.search", title: "Search accessible CRM records", module: "CRM context", read: true, permissions: [], risk: "routine" },
  { key: "crm.context", title: "Read linked CRM context", module: "CRM context", read: true, permissions: [], risk: "routine" },
  { key: "analytics.read", title: "Run expanded CRM analytics", module: "Analytics", read: true, permissions: ["view:reports"], risk: "routine", handler: "analytics" },
];
export const LEGACY_TOOLS: Record<string, { capability: string; scope: string; permissions: PermissionKey[]; read: boolean }> = {
  search_letters: { capability: "letters.search", scope: "letters.read", permissions: ["letters.view"], read: true },
  read_letter: { capability: "letters.content.read", scope: "letters.read", permissions: ["letters.view"], read: true },
  get_letter_design_options: { capability: "letters.design.read", scope: "letters.read", permissions: ["letters.view"], read: true },
  preview_letter_draft: { capability: "letters.preview.read", scope: "letters.read", permissions: ["letters.view"], read: true },
  list_letter_images: { capability: "images.read", scope: "letters.read", permissions: ["letters.view"], read: true },
  create_letter_draft: { capability: "letters.draft.create", scope: "letters.write", permissions: ["letters.create", "letters.edit"], read: false },
  update_letter_draft: { capability: "letters.draft.update", scope: "letters.write", permissions: ["letters.create", "letters.edit"], read: false },
  import_letter_image: { capability: "images.import", scope: "letters.write", permissions: ["letters.create", "letters.edit"], read: false },
  generate_letter_image: { capability: "images.generate", scope: "letters.write", permissions: ["letters.create", "letters.edit"], read: false },
  get_letter_image_job: { capability: "images.jobs.read", scope: "letters.write", permissions: ["letters.view"], read: true },
  list_reports: { capability: "reports.list", scope: "reports.read", permissions: ["view:reports"], read: true },
  get_reporting_context: { capability: "reports.context.read", scope: "reports.read", permissions: ["view:reports"], read: true },
  run_report: { capability: "reports.run", scope: "reports.read", permissions: ["view:reports"], read: true },
};
for (const [name, item] of Object.entries(LEGACY_TOOLS)) CAPABILITIES.push({ key: item.capability, title: name.replace(/_/g, " "), module: name.includes("report") ? "Analytics" : "Communications", read: item.read, permissions: item.permissions, risk: "routine" });
export const capabilityFor = (key: string) => CAPABILITIES.find(capability => capability.key === key);
export const resourceFor = (key: string) => RESOURCES.find(res => res.key === key);
export const toolName = (capability: AiCapability) => `crm_${capability.key.replace(/\./g, "_")}`;
export const AI_SCOPES = CAPABILITIES.filter(capability => !Object.values(LEGACY_TOOLS).some(item => item.capability === capability.key)).map(capability => capability.key);
