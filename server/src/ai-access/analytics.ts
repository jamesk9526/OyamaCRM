import type { Request } from "express";
import type { ChatGptGrant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { completedDonationWhere } from "../lib/donationScope.js";
import { moneyToCents, centsToMoney } from "../lib/money.js";
import { reportingContext } from "../chatgpt/reporting.js";
import { CreateError } from "../oyama-create/domain.js";
import { decideAccess, demandAccess } from "./policy.js";
import { rawRecord, presentRecord, constraintWhere } from "./records.js";
import { resourceFor } from "./catalog.js";

export const ANALYTICS = [
  { key: "giving-trend", title: "Monthly completed giving", definition: "Recorded completed gift amounts and gift counts grouped by UTC calendar month." },
  { key: "donor-retention", title: "Donor retention", definition: "Donors giving in both the selected period and its immediately preceding equal-duration period, divided by distinct donors in that prior period. Zero prior donors gives null percent." },
  { key: "lapsed-donors", title: "Lapsed donors", definition: "Donors with completed giving before the selected period and no completed gift during it." },
  { key: "first-time-donors", title: "First-time donors", definition: "Donors whose earliest recorded completed gift falls within the selected period." },
  { key: "recurring-giving", title: "Recurring giving", definition: "Completed gifts marked recurring in the selected period; not a forecast or recurring-payment mandate." },
  { key: "event-performance", title: "Event-attributed giving", definition: "Completed donations with recorded event attribution in the selected period. Ticket orders, sponsorship contracts and campaign expenses are not added to gift totals." },
] as const;
export async function runAnalytics(req: Request, grant: ChatGptGrant, report: string, from: string, through: string, origin: string) {
  const access = await demandAccess(req, "analytics.read", grant), definition = ANALYTICS.find(item => item.key === report);
  if (!definition) throw new CreateError(400, "Choose a defined CRM analysis.");
  const start = new Date(`${from}T00:00:00.000Z`), end = new Date(`${through}T23:59:59.999Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(through) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== through || start > end) throw new CreateError(400, "Use a valid inclusive YYYY-MM-DD date range.");
  const giftsResource = resourceFor("gifts")!, giftAccess = await decideAccess(req, "gifts.read", grant);
  const where = { AND: [completedDonationWhere(req.user!.orgId), { date: { lte: end } }, ...(giftAccess.mode !== "blocked" ? giftAccess.constraints.map(rule => constraintWhere(req, giftsResource, rule)) : [])] };
  const count = await prisma.donation.count({ where });
  if (count > 50000) throw new CreateError(413, "This analysis exceeds the current 50,000-gift calculation limit. Use the CRM report library for this organization's larger history.");
  const gifts = await prisma.donation.findMany({ where, select: { id: true, constituentId: true, amount: true, date: true, isRecurring: true, eventId: true }, orderBy: { id: "asc" }, take: 50001 });
  if (gifts.length > 50000) throw new CreateError(413, "Giving history changed beyond the calculation limit. Run the CRM report library.");
  const current = gifts.filter(gift => gift.date >= start), duration = end.getTime() - start.getTime() + 1;
  const priorStart = new Date(start.getTime() - duration), priorEnd = new Date(start.getTime() - 1);
  const currentIds = new Set(current.map(gift => gift.constituentId)), priorIds = new Set(gifts.filter(gift => gift.date >= priorStart && gift.date < start).map(gift => gift.constituentId));
  const first = new Map<string, Date>();
  for (const gift of gifts) if (!first.has(gift.constituentId) || first.get(gift.constituentId)! > gift.date) first.set(gift.constituentId, gift.date);
  let rows: Record<string, unknown>[] = [], summary: Record<string, unknown> = {};
  if (report === "giving-trend") {
    const months = new Map<string, { cents: number; gifts: number; donors: Set<string> }>();
    for (const gift of current) { const key = gift.date.toISOString().slice(0, 7), group = months.get(key) || { cents: 0, gifts: 0, donors: new Set<string>() }; group.cents += moneyToCents(gift.amount); group.gifts++; group.donors.add(gift.constituentId); months.set(key, group); }
    rows = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, group]) => ({ month, amount: centsToMoney(group.cents), gifts: group.gifts, distinctDonors: group.donors.size }));
  } else if (report === "donor-retention") {
    const retained = [...priorIds].filter(id => currentIds.has(id)).length;
    summary = { priorDonors: priorIds.size, currentDonors: currentIds.size, retainedDonors: retained, retentionPercent: priorIds.size ? Math.round(retained / priorIds.size * 1000) / 10 : null, comparison: { from: priorStart.toISOString(), through: priorEnd.toISOString() } };
  } else if (report === "recurring-giving") {
    const recurring = current.filter(gift => gift.isRecurring);
    summary = { gifts: recurring.length, distinctDonors: new Set(recurring.map(gift => gift.constituentId)).size, amount: centsToMoney(recurring.reduce((sum, gift) => sum + moneyToCents(gift.amount), 0)) };
  } else if (report === "event-performance") {
    const groups = new Map<string, { cents: number; gifts: number }>();
    for (const gift of current) { const key = gift.eventId || "unattributed", group = groups.get(key) || { cents: 0, gifts: 0 }; group.cents += moneyToCents(gift.amount); group.gifts++; groups.set(key, group); }
    const eventsGranted = (await decideAccess(req, "events.read", grant)).mode !== "blocked";
    for (const [eventId, group] of groups) {
      if (eventId === "unattributed") { rows.push({ event: "Unattributed", amount: centsToMoney(group.cents), gifts: group.gifts }); continue; }
      if (!eventsGranted) continue;
      try { const event = await rawRecord(req, resourceFor("events")!, eventId, grant); rows.push({ eventId, event: event.name, amount: centsToMoney(group.cents), gifts: group.gifts, url: `${origin}/events/${encodeURIComponent(eventId)}` }); }
      catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
    }
  } else {
    const candidates = [...first].filter(([id, date]) => report === "lapsed-donors" ? date < start && !currentIds.has(id) : date >= start).map(([id]) => id);
    summary = { matchingDonors: candidates.length };
    if ((await decideAccess(req, "constituents.read", grant)).mode !== "blocked" && (await decideAccess(req, "gifts.read", grant)).mode !== "blocked") for (const id of candidates) {
      try { const res = resourceFor("constituents")!, raw = await rawRecord(req, res, id, grant); rows.push(await presentRecord(req, res, raw, grant, origin)); }
      catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
      if (rows.length >= access.limits.maxRows) break;
    }
  }
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: req.user!.orgId }, select: { fiscalYearStart: true, currency: true, timezone: true } });
  return { report, definition, period: { from: start.toISOString(), through: end.toISOString(), inclusive: true }, summary, rows: rows.slice(0, access.limits.maxRows), totalCompletedGiving: centsToMoney(current.reduce((sum, gift) => sum + moneyToCents(gift.amount), 0)), financialContext: reportingContext(settings), generatedAt: new Date().toISOString(), notices: ["Calendar boundaries use UTC days. Totals include all matching completed gifts; donor detail rows require separate record access.", "A donor can occur in more than one group. Group donor counts cannot be added to get a unique total."], url: `${origin}/reports`, truncated: rows.length > access.limits.maxRows || Number(summary.matchingDonors || 0) > rows.length };
}
