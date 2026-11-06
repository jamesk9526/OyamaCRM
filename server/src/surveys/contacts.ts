import type { SurveyAudience } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { evaluateRecipientEligibility, isValidEmailAddress } from "../services/email-compliance.js";

export async function surveyContacts(organizationId: string, audience: SurveyAudience, filter: { ids: string[] } | { q: string } | { all: true }) {
  const text = "q" in filter ? filter.q : "";
  const selection = "ids" in filter ? { id: { in: filter.ids } } : text ? {
    OR: [{ firstName: { contains: text } }, { lastName: { contains: text } }, { email: { contains: text } }],
  } : {};
  const take = "ids" in filter ? filter.ids.length : "all" in filter ? 10001 : 25;
  if (!take) return [];
  if (audience === "CLIENT") {
    const clients = await db.compassionClient.findMany({ where: { organizationId, clientStatus: { not: "ARCHIVED" }, ...selection },
      select: { id: true, firstName: true, lastName: true, preferredName: true, email: true, safeContact: true },
      orderBy: [{ lastName: "asc" }, { id: "asc" }], take });
    return clients.map(row => ({
      id: row.id, name: `${row.preferredName || row.firstName} ${row.lastName}`.trim(), email: row.email?.trim().toLowerCase() || "",
      safeEmail: Boolean(row.safeContact && typeof row.safeContact === "object" && "email" in row.safeContact && row.safeContact.email === true),
      doNotContact: false, doNotEmail: false, emailOptOut: false,
    }));
  }
  const donors = await db.constituent.findMany({ where: { organizationId, closedAt: null, ...selection,
    ...(text ? { OR: [...(selection.OR ?? []), { displayName: { contains: text } }, { organizationName: { contains: text } }] } : {}),
  }, select: { id: true, displayName: true, organizationName: true, firstName: true, lastName: true, email: true,
    doNotContact: true, doNotEmail: true, emailOptOut: true }, orderBy: [{ lastName: "asc" }, { id: "asc" }], take });
  const members = "ids" in filter && filter.ids.some(id => id.startsWith("list:")) ? await db.emailRecipientListMember.findMany({
    where: { id: { in: filter.ids.filter(id => id.startsWith("list:")).map(id => id.slice(5)) }, constituentId: null, list: { organizationId } },
    select: { id: true, firstName: true, lastName: true, email: true }, take,
  }) : [];
  return [...donors.map(row => ({
    id: row.id, name: row.displayName || row.organizationName || [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed donor",
    email: row.email?.trim().toLowerCase() || "", safeEmail: true, doNotContact: row.doNotContact,
    doNotEmail: row.doNotEmail, emailOptOut: row.emailOptOut,
  })), ...members.map(row => ({ id: `list:${row.id}`, name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "List contact", email: row.email?.trim().toLowerCase() || "", safeEmail: true, doNotContact: false, doNotEmail: false, emailOptOut: false }))];
}

export type SurveyContact = Awaited<ReturnType<typeof surveyContacts>>[number];

export async function emailDecisions(organizationId: string, audience: SurveyAudience, contacts: SurveyContact[]) {
  if (audience === "DONOR") {
    const eligibility = await evaluateRecipientEligibility({ organizationId, purpose: "MARKETING", category: "SURVEY",
      candidates: contacts.map(contact => ({ ...contact, constituentId: contact.id.startsWith("list:") ? null : contact.id })) });
    return new Map(contacts.map((contact, index) => [contact.id, eligibility.decisions[index]?.ineligibilityReason === null ? null : eligibility.decisions[index]?.ineligibilityReason ?? "Email eligibility could not be verified."]));
  }
  const seen = new Set<string>();
  return new Map(contacts.map(contact => {
    let reason: string | null = null;
    if (!contact.safeEmail) reason = "Safe email contact is not permitted.";
    else if (!isValidEmailAddress(contact.email)) reason = "Missing or invalid email address.";
    else if (seen.has(contact.email)) reason = "Duplicate recipient email.";
    else seen.add(contact.email);
    return [contact.id, reason];
  }));
}
