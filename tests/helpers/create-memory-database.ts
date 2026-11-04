/* eslint-disable @typescript-eslint/no-explicit-any -- Synthetic Prisma-shaped persistence for real HTTP handlers; never a substitute for MySQL verification. */
import { Prisma } from "@prisma/client";
type Row = Record<string, any>;
export const createRows: Record<string, Row[]> = {};
let sequence = 0;
const clone = <T>(value: T): T => structuredClone(value);
const related = (model: string, row: Row, key: string): [string, Row | Row[] | undefined] => {
  const one = (target: string, id: string) => [target, createRows[target]?.find(item => item.id === id)] as [string, Row | undefined];
  const many = (target: string, field: string) => [target, (createRows[target] || []).filter(item => item[field] === row.id)] as [string, Row[]];
  if (model === "createContent" && key === "campaign") return one("createCampaign", row.campaignId);
  if (model === "createContent" && key === "variants") return many("createVariant", "contentId");
  if (model === "createVariant" && key === "content") return one("createContent", row.contentId);
  if (model === "createRelease" && key === "campaign") return one("createCampaign", row.campaignId);
  if (model === "createDelivery" && key === "release") return one("createRelease", row.releaseId);
  if (model === "createCampaign" && key === "contents") return many("createContent", "campaignId");
  if (model === "createCampaign" && key === "releases") return many("createRelease", "campaignId");
  if (model === "emailRecipientList" && key === "recipients") return many("emailRecipientListMember", "listId");
  if ((model === "donation" || model === "pledge") && key === "constituent") return one("constituent", row.constituentId);
  return ["", undefined];
};
function matches(model: string, row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === "OR") return expected.some((item: Row) => matches(model, row, item));
    if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every((item: Row) => matches(model, row, item));
    const [target, relation] = related(model, row, key);
    if (target) return !!relation && !Array.isArray(relation) && matches(target, relation, expected);
    const actual = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if (!(key in row) && key.includes("_")) return matches(model, row, expected);
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === "in") return (value as unknown[]).includes(actual);
        if (operator === "not") return actual !== value;
        if (operator === "contains") return String(actual || "").includes(String(value));
        if (operator === "lt") return actual < value!;
        if (operator === "gt") return actual > value!;
        if (operator === "lte") return actual <= value!;
        if (operator === "gte") return actual >= value!;
        return false;
      });
    }
    if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
    return (actual ?? null) === expected;
  });
}
function projected(model: string, row: Row, args: Row = {}): Row {
  const result = args.select ? {} : clone(row);
  for (const [key, option] of Object.entries(args.select || args.include || {})) {
    if (!option) continue;
    if (key === "_count") { result[key] = {}; for (const field of Object.keys((option as Row).select || {})) { const [, value] = related(model, row, field); result[key][field] = Array.isArray(value) ? value.length : 0; } continue; }
    const [target, relation] = related(model, row, key);
    if (!target) { if (args.select) result[key] = clone(row[key]); continue; }
    const nested = option === true ? {} : option as Row;
    result[key] = Array.isArray(relation) ? relation.map(item => projected(target, item, nested)).slice(0, nested.take || Infinity) : relation ? projected(target, relation, nested) : null;
  }
  return result;
}
function defaults(model: string, data: Row): Row {
  const now = new Date(); const common = { id: `synthetic-${++sequence}`, createdAt: now, updatedAt: now };
  const base: Record<string, Row> = {
    createCampaign: { revision: 1, status: "DRAFT", isTemplate: false, startsAt: null, endsAt: null, fundraisingCampaignId: null, eventId: null, deliveryMode: null },
    createContent: { revision: 1, scheduledAt: null, designJson: null }, createVariant: { revision: 1, needsReview: false, nativeApproved: false, legacyId: null, legacyFingerprint: null },
    createRelease: { status: "APPROVED", approvedAt: now }, createDelivery: { status: "HELD", attempts: 0, claimedAt: null, executionId: null, providerId: null, error: null, acceptedAt: null, deliveredAt: null },
    emailCampaign: { status: "DRAFT", purpose: "MARKETING", totalRecipients: 0, sentAt: null, scheduledAt: null, audienceFilter: null, previewText: null, replyToEmail: null },
    letterTemplate: { status: "DRAFT", crmScope: "DONOR", revision: 0, printLayoutJson: null, documentJson: null },
    createLead: { status: "PENDING" },
    createBrandDraft: { revision: 1 }, createBrandRevision: { publishedAt: now }, createBrandBinding: { revision: 1 },
  };
  return { ...common, ...base[model], ...clone(data) };
}
function update(row: Row, data: Row) { for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : clone(value); row.updatedAt = new Date(); }
const uniques: Record<string, string[][]> = { createBrandDraft: [["organizationId"]], createBrandRevision: [["organizationId", "revision"]], createBrandBinding: [["organizationId", "channel", "resourceId"]], createResponseCode: [["code"], ["lookupKey"]], createPrintArtifact: [["deliveryId", "kind"]], createVariant: [["organizationId", "channel", "legacyId"], ["contentId", "channel"]], createRelease: [["campaignId", "campaignRevision"]], createDelivery: [["deliveryKey"]], createConnection: [["organizationId", "provider"]], createSmsConsent: [["organizationId", "phone"]], createWebhookEvent: [["organizationId", "provider", "eventKey"]] };
const models = ["user", "userPermission", "organization", "organizationSettings", "createCampaign", "createContent", "createVariant", "createDocumentRevision", "createRelease", "createDelivery", "createConnection", "createSmsConsent", "createWebhookEvent", "createLead", "createPublication", "emailCampaign", "emailSendRecipient", "emailCampaignDeliveryEvent", "emailRecipientList", "emailRecipientListMember", "letterTemplate", "constituent", "campaign", "event", "auditLog", "donation", "generatedLetter", "letterRenderJob", "pluginSetting", "letterHeaderPreset", "letterFooterPreset", "letterSignatureBlock", "createBrandDraft", "createBrandRevision", "createBrandBinding", "createStudioAsset", "createStudioSection", "createResponseCode", "createPrintArtifact", "pledge", "recurringDonation"];
export const createMemoryDatabase: any = {};
for (const model of models) {
  createRows[model] = [];
  const methods = {
    findMany: async (args: Row = {}) => {
      let rows = createRows[model].filter(row => matches(model, row, args.where));
      for (const order of [...(Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy || {}])].reverse()) for (const [field, direction] of Object.entries(order)) rows = rows.toSorted((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (direction === "desc" ? -1 : 1));
      return rows.slice(args.skip || 0, (args.skip || 0) + (args.take || Infinity)).map(row => projected(model, row, args));
    },
    findFirst: async (args: Row = {}) => (await methods.findMany({ ...args, take: 1 }))[0] || null,
    findUnique: async (args: Row) => methods.findFirst(args),
    findUniqueOrThrow: async (args: Row) => { const row = await methods.findFirst(args); if (!row) throw new Error(`${model} not found`); return row; },
    create: async (args: Row) => {
      const row = defaults(model, args.data);
      if ((uniques[model] || []).some(fields => fields.every(field => row[field] != null) && createRows[model].some(existing => fields.every(field => existing[field] === row[field])))) throw new Prisma.PrismaClientKnownRequestError("Synthetic unique conflict", { code: "P2002", clientVersion: "synthetic" });
      createRows[model].push(row); return projected(model, row, args);
    },
    createMany: async (args: Row) => { for (const data of args.data) await methods.create({ data }); return { count: args.data.length }; },
    updateMany: async (args: Row) => { const rows = createRows[model].filter(row => matches(model, row, args.where)); rows.forEach(row => update(row, args.data)); return { count: rows.length }; },
    update: async (args: Row) => { const row = createRows[model].find(row => matches(model, row, args.where)); if (!row) throw new Error(`${model} not found`); update(row, args.data); return projected(model, row, args); },
    upsert: async (args: Row) => await methods.findFirst({ where: args.where }) ? methods.update({ where: args.where, data: args.update }) : methods.create({ data: args.create }),
    count: async (args: Row = {}) => createRows[model].filter(row => matches(model, row, args.where)).length,
    groupBy: async () => [], aggregate: async () => ({ _sum: { amount: 0 }, _count: { _all: 0 } }),
  };
  createMemoryDatabase[model] = methods;
}
createMemoryDatabase.$transaction = async (work: (tx: any) => Promise<unknown>) => { const previous = clone(createRows); try { return await work(createMemoryDatabase); } catch (error) { for (const key of Object.keys(createRows)) createRows[key] = previous[key]; throw error; } };
export function resetCreateRows() { for (const key of Object.keys(createRows)) createRows[key] = []; sequence = 0; }
