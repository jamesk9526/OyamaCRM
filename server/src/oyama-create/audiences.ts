import { prisma } from "../lib/prisma.js";
import { evaluateRecipientEligibility } from "../services/email-compliance.js";
import { CreateError, planAudience, type AudienceMember, type Channel, type DeliveryMode } from "./domain.js";

export async function audienceMembers(org: string, listIds: string[]): Promise<AudienceMember[]> {
  if (listIds.length > 25 || new Set(listIds).size !== listIds.length) throw new CreateError(400, "Choose up to 25 distinct saved audiences.");
  if (!listIds.length) return [];
  const lists = await prisma.emailRecipientList.findMany({ where: { organizationId: org, id: { in: listIds } }, include: { recipients: { take: 5001 } } });
  if (lists.length !== listIds.length) throw new CreateError(404, "An audience is unavailable in this organization.");
  const raw = lists.flatMap(list => list.recipients);
  if (raw.length > 5000) throw new CreateError(422, "This release supports up to 5,000 audience entries. Split the audience into reviewed releases.");
  const contacts = await prisma.constituent.findMany({ where: { organizationId: org, id: { in: raw.flatMap(row => row.constituentId ? [row.constituentId] : []) } } });
  const byId = new Map(contacts.map(row => [row.id, row])); const seen = new Set<string>(); const result: AudienceMember[] = [];
  for (const row of raw) {
    const contact = row.constituentId ? byId.get(row.constituentId) : undefined;
    // Deleted/closed/foreign constituent-backed entries never degrade to unlinked contacts.
    if (row.constituentId && !contact) continue;
    const email = (contact?.email || row.email || "").trim().toLowerCase();
    const key = contact?.id || `email:${email}`;
    if (seen.has(key)) continue; seen.add(key);
    result.push({ key, constituentId: contact?.id || null, firstName: contact?.firstName || row.firstName || "", lastName: contact?.lastName || row.lastName || "", name: contact?.displayName || contact?.organizationName || [contact?.firstName || row.firstName, contact?.lastName || row.lastName].filter(Boolean).join(" "), email, phone: contact?.phone?.trim() || "", addressLine1: contact?.addressLine1 || "", addressLine2: contact?.addressLine2 || "", city: contact?.city || "", state: contact?.state || "", zip: contact?.zip || "", country: contact?.country || "", doNotContact: contact?.doNotContact || false, doNotMail: contact?.doNotMail || false, doNotEmail: contact?.doNotEmail || false, emailOptOut: contact?.emailOptOut || false });
  }
  return result;
}
export async function resolvePlan(org: string, listIds: string[], channels: Channel[], mode: DeliveryMode | null, objective: string) {
  const members = await audienceMembers(org, listIds);
  const evaluation = channels.includes("EMAIL") ? await evaluateRecipientEligibility({ organizationId: org, purpose: objective === "FUNDRAISING" ? "FUNDRAISING" : objective === "ACKNOWLEDGMENT" ? "THANK_YOU" : objective === "NEWSLETTER" ? "NEWSLETTER" : objective === "EVENT" ? "EVENT_PROMOTION" : "MARKETING", candidates: members.map(row => ({ ...row, email: row.email })) }) : { recipients: [] };
  const consent = channels.includes("SMS") ? await prisma.createSmsConsent.findMany({ where: { organizationId: org, phone: { in: members.map(row => row.phone).filter(Boolean) }, status: "OPTED_IN" } }) : [];
  return planAudience(members, channels, mode, new Set(evaluation.recipients), new Set(consent.map(row => row.phone)));
}
