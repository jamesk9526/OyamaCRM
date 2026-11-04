import type { Request } from "express";
import type { CreateCampaign } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getConstituentDisplayName, getConstituentSalutation } from "../../lib/constituent-identity.js";
import { getYearRange, getFiscalYearRange, normalizeFiscalYearStart } from "../../lib/dateRanges.js";
import { can, demand } from "../access.js";
import { CreateError } from "../domain.js";
import { emptyDonor } from "./render.js";
import type { StudioDesign, DonorContext } from "./types.js";

export function givingPeriod(design: StudioDesign, fiscalStart = 1) {
  if (design.data.period === "custom") { const gte = new Date(`${design.data.from}T00:00:00`), lt = new Date(`${design.data.to}T00:00:00`); lt.setDate(lt.getDate()+1); return {gte,lt}; }
  const start = normalizeFiscalYearStart(fiscalStart);
  return design.data.period === "fiscal" ? getFiscalYearRange(design.data.year + (start === 1 ? 0 : 1), start) : getYearRange(design.data.year);
}
export async function resolveStudioDonor(req: Request, campaign: CreateCampaign, design: StudioDesign, constituentId?: string, asOf = new Date()): Promise<DonorContext> {
  const org = campaign.organizationId, context = emptyDonor(asOf.toISOString());
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  context.currency=settings?.currency||"USD";
  if (campaign.fundraisingCampaignId) {
    await demand(req, "view:campaigns");
    const financial = await prisma.campaign.findFirst({ where: { id: campaign.fundraisingCampaignId, organizationId: org } });
    if (!financial) throw new CreateError(422, "The linked fundraising campaign is unavailable.");
    const raised = await prisma.donation.aggregate({ where: { campaignId: financial.id, constituent: { organizationId: org }, status: "COMPLETED" }, _sum: { amount: true } });
    context.campaign = { id: financial.id, name: financial.name, goal: financial.goal==null?null:Number(financial.goal), raised: Number(raised._sum.amount || 0) };
  }
  context.sensitiveAllowed = await can(req, "letters.view_sensitive_merge_data");
  if (!constituentId) return context;
  await demand(req, "view:constituents");
  const person = await prisma.constituent.findFirst({ where: { id: constituentId, organizationId: org }, include: { tags: { include: { tag: true } } } });
  if (!person) throw new CreateError(404, "Recipient not found in this organization.");
  context.mergeValues = Object.fromEntries(["firstName", "lastName", "preferredName", "displayName", "organizationName", "organizationCategory", "contactFirstName", "contactLastName", "contactTitle", "email", "phone", "addressLine1", "addressLine2", "city", "state", "zip"].map(key => [`donor.${key}`, String((person as unknown as Record<string,unknown>)[key] || "")]));
  Object.assign(context, { available: true, constituentId: person.id, name: getConstituentDisplayName(person), salutation: getConstituentSalutation(person), entityKind: person.entityKind || "INDIVIDUAL", address: [person.addressLine1, person.addressLine2, [person.city, person.state, person.zip].filter(Boolean).join(" "), person.country].filter(Boolean).join("\n"), tags: person.tags.map(item => item.tag.name) });
  if (!context.sensitiveAllowed) return context;
  const period = givingPeriod(design, settings?.fiscalYearStart || 1);
  const selectedId = design.data.giftSelections[person.id];
  const [gifts, selectedGift, lastGift, largestGift, pledges, recurring] = await Promise.all([
    prisma.donation.findMany({ where: { constituentId: person.id, constituent: { organizationId: org }, status: "COMPLETED", date: period }, orderBy: [{ date: "asc" }, { id: "asc" }], include: { designation: true }, take: 5001 }),
    design.data.giftPolicy === "selected" && selectedId ? prisma.donation.findFirst({ where: { id: selectedId, constituentId: person.id, constituent: { organizationId: org }, status: "COMPLETED" }, include: { designation: true } }) : null,
    prisma.donation.findFirst({ where: { constituentId: person.id, constituent: { organizationId: org }, status: "COMPLETED" }, orderBy: [{ date: "desc" }, { id: "desc" }], include: { designation: true } }),
    prisma.donation.findFirst({ where: { constituentId: person.id, constituent: { organizationId: org }, status: "COMPLETED" }, orderBy: [{ amount: "desc" }, { id: "desc" }] }),
    prisma.pledge.findMany({ where: { constituentId: person.id, constituent: { organizationId: org }, active: true, ...(campaign.fundraisingCampaignId ? { campaignId: campaign.fundraisingCampaignId } : {}) }, orderBy: { endDate: "asc" }, take: 501 }),
    prisma.donation.findFirst({ where: { constituentId: person.id, constituent: { organizationId: org }, status: "COMPLETED", isRecurring: true }, select: { id: true } }),
  ]);
  if (gifts.length > 5000 || pledges.length > 500) throw new CreateError(422, "This recipient has too many records for one proof. Narrow the giving period or campaign before review.");
  if (selectedId && design.data.giftPolicy === "selected" && !selectedGift) throw new CreateError(422, "The selected gift is unavailable, belongs to another recipient, or is not completed.");
  const gift = design.data.giftPolicy === "selected" ? selectedGift : lastGift;
  context.gift = gift ? { id: gift.id, amount: Number(gift.amount), date: gift.date.toISOString(), fund: gift.designation?.name || "", receiptNumber: gift.receiptNumber || "", deductible: gift.taxDeductible ? Number(gift.taxDeductibleAmount ?? gift.amount) : 0 } : null;
  context.giving = { total: gifts.reduce((sum, row) => sum + Number(row.amount), 0), count: gifts.length, largest: Number(largestGift?.amount || 0), lastAmount: lastGift ? Number(lastGift.amount) : null, firstDate: gifts[0]?.date.toISOString() || null, lastDate: lastGift?.date.toISOString() || null, gifts: gifts.map(row => ({ amount: Number(row.amount), date: row.date.toISOString(), fund: row.designation?.name || "" })) };
  context.recurring = !!recurring;
  // The reminder is a disclosed total of active pledges in the selected campaign, not an arbitrary pledge.
  context.pledge = pledges.length ? { amount: pledges.reduce((sum, row) => sum + Number(row.totalAmount), 0), paid: pledges.reduce((sum, row) => sum + Number(row.paidAmount), 0), balance: pledges.reduce((sum, row) => sum + Math.max(0, Number(row.totalAmount) - Number(row.paidAmount)), 0), due: pledges.map(row => row.endDate?.toISOString()).filter((value): value is string => !!value).sort()[0] || null } : null;
  return context;
}
