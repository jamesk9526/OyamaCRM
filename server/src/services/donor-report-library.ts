import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { completedDonationWhere } from "../lib/donationScope.js";
import {
  getFiscalYearForDate,
  getFiscalYearRange,
  getYearRange,
  normalizeFiscalYearStart,
  type ReportingYearBasis,
} from "../lib/dateRanges.js";
import { centsToMoney, moneyToCents } from "../lib/money.js";
import { parseCalendarDateExclusiveEnd, parseCalendarDateStart } from "../lib/dateOnlyRanges.js";

export const DONOR_LIBRARY_REPORT_KEYS = [
  "batch-receipts",
  "unacknowledged-gifts",
  "donations",
  "donations-by-designation",
  "lifetime-giving",
  "monthly-giving",
  "comprehensive-donor-analysis",
  "donor-files",
  "giving-capacity-interest",
  "donor-follow-up",
  "donor-notes",
  "first-time-donors",
  "lapsed-donors",
  "never-given",
  "top-donors",
  "payment-method-summary",
  "designation-performance",
  "crm-performance-scorecard",
  "recurring-giving",
  "campaign-performance",
] as const;

export type DonorLibraryReportKey = (typeof DONOR_LIBRARY_REPORT_KEYS)[number];
export type DonorReportCell = string | number | null;

export interface DonorLibraryReportColumn {
  key: string;
  label: string;
  type?: "currency" | "date" | "number" | "text";
  linkToDonor?: boolean;
}

export interface DonorLibraryReport {
  report: DonorLibraryReportKey;
  title: string;
  description: string;
  period: { from: string; through: string; label: string } | null;
  summary: Array<{ label: string; value: DonorReportCell; type?: "currency" | "number" | "text" }>;
  columns: DonorLibraryReportColumn[];
  rows: Array<Record<string, DonorReportCell>>;
  comparisonMatrix?: {
    columns: { currentYear: number; priorYear: number; twoYearsPrior: number };
    labels?: { current: string; prior: string; twoYearsPrior: string };
    sections: Array<{
      label: string;
      rows: Array<{
        label: string;
        current: number;
        prior: number;
        twoYearsPrior: number;
        difference?: number | null;
        type: "currency" | "number" | "decimal";
      }>;
    }>;
  };
  notices: string[];
  generatedAt: string;
}

export interface DonorLibraryReportOptions {
  from: Date;
  through: Date;
  paymentMethod?: PaymentMethod;
  designationId?: string;
  limit: number;
  selectedYear: number;
  dateBasis: ReportingYearBasis;
  fiscalYearStart: number;
}

const PAYMENT_METHODS: PaymentMethod[] = ["CREDIT_CARD", "ACH", "CHECK", "WIRE", "STOCK", "IN_KIND", "CASH", "ONLINE"];

function parseDate(value: unknown, fallback: Date, inclusiveEnd = false): Date {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (inclusiveEnd) {
    const exclusiveEnd = parseCalendarDateExclusiveEnd(value);
    if (exclusiveEnd) return new Date(exclusiveEnd.getTime() - 1);
  }
  return parseCalendarDateStart(value) ?? fallback;
}

function normalizedRange(from: Date, through: Date): { from: Date; through: Date } {
  return from <= through ? { from, through } : { from: through, through: from };
}

function reportDefaultFrom(report: DonorLibraryReportKey, now: Date): Date {
  if (report === "comprehensive-donor-analysis") {
    return new Date(Date.UTC(now.getUTCFullYear() - 2, 0, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

export function isDonorLibraryReportKey(value: string): value is DonorLibraryReportKey {
  return (DONOR_LIBRARY_REPORT_KEYS as readonly string[]).includes(value);
}

export function parseDonorLibraryReportOptions(
  report: DonorLibraryReportKey,
  query: Record<string, unknown>,
  now = new Date(),
  configuration: { fiscalYearStart?: number } = {},
): DonorLibraryReportOptions {
  const defaultFrom = reportDefaultFrom(report, now);
  const range = normalizedRange(
    parseDate(query.from, defaultFrom),
    parseDate(query.through, now, true),
  );
  const paymentCandidate = typeof query.paymentMethod === "string" ? query.paymentMethod.toUpperCase() : "";
  const requestedLimit = Number.parseInt(typeof query.limit === "string" ? query.limit : "", 10);
  const dateBasis: ReportingYearBasis = query.dateBasis === "fiscal" ? "fiscal" : "calendar";
  const fiscalYearStart = normalizeFiscalYearStart(configuration.fiscalYearStart);
  const currentReportingYear = dateBasis === "fiscal"
    ? getFiscalYearForDate(now, fiscalYearStart)
    : now.getFullYear();
  const requestedYear = Number.parseInt(typeof query.year === "string" ? query.year : "", 10);

  return {
    ...range,
    paymentMethod: PAYMENT_METHODS.includes(paymentCandidate as PaymentMethod) ? paymentCandidate as PaymentMethod : undefined,
    designationId: typeof query.designationId === "string" && query.designationId.trim() ? query.designationId.trim() : undefined,
    limit: Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 1_000)) : 100,
    selectedYear: Number.isFinite(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentReportingYear,
    dateBasis,
    fiscalYearStart,
  };
}

function donorName(donor: { displayName?: string | null; organizationName?: string | null; firstName: string; lastName: string; email?: string | null }): string {
  return donor.displayName?.trim()
    || donor.organizationName?.trim()
    || `${donor.firstName} ${donor.lastName}`.trim()
    || donor.email?.trim()
    || "Unnamed donor";
}

function cents(value: unknown): number {
  return moneyToCents(value);
}

function dollars(value: number): number {
  return centsToMoney(value);
}

function selectedYearRange(options: DonorLibraryReportOptions, year: number) {
  return options.dateBasis === "fiscal"
    ? getFiscalYearRange(year, options.fiscalYearStart)
    : getYearRange(year);
}

function reportingYearForDate(options: DonorLibraryReportOptions, value: Date): number {
  return options.dateBasis === "fiscal"
    ? getFiscalYearForDate(value, options.fiscalYearStart)
    : value.getFullYear();
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function period(from: Date, through: Date): DonorLibraryReport["period"] {
  return {
    from: from.toISOString(),
    through: through.toISOString(),
    label: `${from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} – ${through.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
  };
}

function baseDonationWhere(organizationId: string, options: DonorLibraryReportOptions): Prisma.DonationWhereInput {
  return {
    ...completedDonationWhere(organizationId, { gte: options.from, lte: options.through }),
    ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
    ...(options.designationId ? { designationId: options.designationId } : {}),
  };
}

const donationSelection = {
  id: true,
  amount: true,
  date: true,
  paymentMethod: true,
  isRecurring: true,
  receiptNumber: true,
  receiptSentAt: true,
  acknowledgmentSentAt: true,
  constituent: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      organizationName: true,
      email: true,
    },
  },
  designation: { select: { id: true, name: true } },
} satisfies Prisma.DonationSelect;

function emptyReport(report: DonorLibraryReportKey, title: string, description: string, options: DonorLibraryReportOptions): DonorLibraryReport {
  return {
    report,
    title,
    description,
    period: period(options.from, options.through),
    summary: [],
    columns: [],
    rows: [],
    notices: [],
    generatedAt: new Date().toISOString(),
  };
}

async function donationRowsReport(
  organizationId: string,
  reportKey: "donations" | "batch-receipts",
  options: DonorLibraryReportOptions,
): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({
    where: baseDonationWhere(organizationId, options),
    select: donationSelection,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const totalCents = donations.reduce((total, donation) => total + cents(donation.amount), 0);

  if (reportKey === "batch-receipts") {
    const donors = new Map<string, { donorId: string; donorName: string; email: string | null; giftCount: number; totalCents: number; latestGiftDate: string; receiptCount: number; acknowledgedCount: number }>();
    for (const donation of donations) {
      const existing = donors.get(donation.constituent.id) ?? {
        donorId: donation.constituent.id,
        donorName: donorName(donation.constituent),
        email: donation.constituent.email,
        giftCount: 0,
        totalCents: 0,
        latestGiftDate: donation.date.toISOString(),
        receiptCount: 0,
        acknowledgedCount: 0,
      };
      existing.giftCount += 1;
      existing.totalCents += cents(donation.amount);
      if (donation.date > new Date(existing.latestGiftDate)) existing.latestGiftDate = donation.date.toISOString();
      if (donation.receiptNumber || donation.receiptSentAt) existing.receiptCount += 1;
      if (donation.acknowledgmentSentAt) existing.acknowledgedCount += 1;
      donors.set(donation.constituent.id, existing);
    }
    const rows = Array.from(donors.values())
      .sort((a, b) => b.totalCents - a.totalCents || a.donorName.localeCompare(b.donorName))
      .map((donor) => ({
        donorId: donor.donorId,
        donorName: donor.donorName,
        email: donor.email,
        giftCount: donor.giftCount,
        totalAmount: dollars(donor.totalCents),
        latestGiftDate: donor.latestGiftDate,
        receiptStatus: donor.receiptCount === donor.giftCount ? "Receipt recorded" : `${donor.giftCount - donor.receiptCount} need receipt`,
        acknowledgmentStatus: donor.acknowledgedCount === donor.giftCount ? "Acknowledged" : `${donor.giftCount - donor.acknowledgedCount} pending`,
      }));
    return {
      ...emptyReport(reportKey, "Batch receipts", "A receipt-ready register grouped by donor. Print or export the reviewed list before creating receipt communications.", options),
      summary: [
        { label: "Gift total", value: dollars(totalCents), type: "currency" },
        { label: "Gifts", value: donations.length, type: "number" },
        { label: "Donors", value: rows.length, type: "number" },
      ],
      columns: [
        { key: "donorName", label: "Donor", linkToDonor: true },
        { key: "email", label: "Email" },
        { key: "giftCount", label: "Gifts", type: "number" },
        { key: "totalAmount", label: "Gift total", type: "currency" },
        { key: "latestGiftDate", label: "Latest gift", type: "date" },
        { key: "receiptStatus", label: "Receipt status" },
        { key: "acknowledgmentStatus", label: "Thank-you status" },
      ],
      rows,
      notices: ["This report is a receipt register. It does not send or mark receipts automatically."],
    };
  }

  return {
    ...emptyReport(reportKey, "Donations", "A gift-by-gift list for the selected date range and filters.", options),
    summary: [
      { label: "Gift total", value: dollars(totalCents), type: "currency" },
      { label: "Gifts", value: donations.length, type: "number" },
      { label: "Donors", value: new Set(donations.map((donation) => donation.constituent.id)).size, type: "number" },
    ],
    columns: [
      { key: "date", label: "Gift date", type: "date" },
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "designation", label: "Designation" },
      { key: "paymentMethod", label: "Payment method" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "receiptNumber", label: "Receipt #" },
    ],
    rows: donations.map((donation) => ({
      donorId: donation.constituent.id,
      date: donation.date.toISOString(),
      donorName: donorName(donation.constituent),
      email: donation.constituent.email,
      designation: donation.designation?.name ?? "General / undesignated",
      paymentMethod: donation.paymentMethod.replace(/_/g, " "),
      amount: dollars(cents(donation.amount)),
      receiptNumber: donation.receiptNumber ?? "—",
    })),
    notices: [],
  };
}

/** Lists completed gifts that still need a thank-you, without changing any gift status. */
async function unacknowledgedGiftsReport(
  organizationId: string,
  options: DonorLibraryReportOptions,
): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({
    where: { ...baseDonationWhere(organizationId, options), acknowledgmentSentAt: null },
    select: donationSelection,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const totalCents = donations.reduce((total, donation) => total + cents(donation.amount), 0);
  const rows = donations.map((donation) => ({
    donationId: donation.id,
    donorId: donation.constituent.id,
    donorName: donorName(donation.constituent),
    email: donation.constituent.email,
    giftDate: donation.date.toISOString(),
    amount: dollars(cents(donation.amount)),
    designation: donation.designation?.name ?? "Unassigned",
    receiptStatus: donation.receiptNumber || donation.receiptSentAt ? "Receipt recorded" : "No receipt recorded",
  }));
  return {
    ...emptyReport("unacknowledged-gifts", "Unacknowledged gifts", "Completed gifts in the selected date range that do not yet have a recorded thank-you.", options),
    summary: [
      { label: "Gifts awaiting thanks", value: rows.length, type: "number" },
      { label: "Giving awaiting thanks", value: dollars(totalCents), type: "currency" },
      { label: "Donors with email", value: rows.filter((row) => Boolean(row.email)).length, type: "number" },
    ],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "giftDate", label: "Gift date", type: "date" },
      { key: "amount", label: "Gift amount", type: "currency" },
      { key: "designation", label: "Designation" },
      { key: "receiptStatus", label: "Receipt status" },
    ],
    rows,
    notices: ["This report is review-only. Generate a letter or email after confirming each donor's communication preferences."],
  };
}

async function donorsByDesignationReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({
    where: baseDonationWhere(organizationId, options),
    select: donationSelection,
    orderBy: { date: "desc" },
  });
  const rowsByPair = new Map<string, { donorId: string; donorName: string; email: string | null; designation: string; giftCount: number; totalCents: number; lastGiftDate: string }>();
  let totalCents = 0;
  for (const donation of donations) {
    totalCents += cents(donation.amount);
    const designation = donation.designation?.name ?? "General / undesignated";
    const key = `${donation.constituent.id}:${donation.designation?.id ?? "general"}`;
    const row = rowsByPair.get(key) ?? {
      donorId: donation.constituent.id,
      donorName: donorName(donation.constituent),
      email: donation.constituent.email,
      designation,
      giftCount: 0,
      totalCents: 0,
      lastGiftDate: donation.date.toISOString(),
    };
    row.giftCount += 1;
    row.totalCents += cents(donation.amount);
    if (donation.date > new Date(row.lastGiftDate)) row.lastGiftDate = donation.date.toISOString();
    rowsByPair.set(key, row);
  }
  const rows = Array.from(rowsByPair.values())
    .sort((a, b) => a.designation.localeCompare(b.designation) || b.totalCents - a.totalCents)
    .map((row) => ({ ...row, totalAmount: dollars(row.totalCents) }));
  return {
    ...emptyReport("donations-by-designation", "Donations by designation", "Completed gifts grouped by donor and designation for the selected date range.", options),
    summary: [
      { label: "Gift total", value: dollars(totalCents), type: "currency" },
      { label: "Gifts", value: donations.length, type: "number" },
      { label: "Donor/designation rows", value: rows.length, type: "number" },
    ],
    columns: [
      { key: "designation", label: "Designation" },
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "giftCount", label: "Gifts", type: "number" },
      { key: "totalAmount", label: "Total", type: "currency" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
    ],
    rows,
    notices: [],
  };
}

async function donorGivingRows(organizationId: string, date?: Prisma.DateTimeFilter): Promise<Array<{
  donorId: string;
  donorName: string;
  email: string | null;
  firstGiftDate: string;
  lastGiftDate: string;
  giftCount: number;
  totalCents: number;
  largestGiftCents: number;
}>> {
  const donations = await prisma.donation.findMany({
    where: completedDonationWhere(organizationId, date),
    select: {
      amount: true,
      date: true,
      constituent: {
        select: { id: true, firstName: true, lastName: true, displayName: true, organizationName: true, email: true },
      },
    },
    orderBy: { date: "asc" },
  });
  const donors = new Map<string, { donorId: string; donorName: string; email: string | null; firstGiftDate: string; lastGiftDate: string; giftCount: number; totalCents: number; largestGiftCents: number }>();
  for (const donation of donations) {
    const existing = donors.get(donation.constituent.id) ?? {
      donorId: donation.constituent.id,
      donorName: donorName(donation.constituent),
      email: donation.constituent.email,
      firstGiftDate: donation.date.toISOString(),
      lastGiftDate: donation.date.toISOString(),
      giftCount: 0,
      totalCents: 0,
      largestGiftCents: 0,
    };
    const amount = cents(donation.amount);
    existing.giftCount += 1;
    existing.totalCents += amount;
    existing.largestGiftCents = Math.max(existing.largestGiftCents, amount);
    if (donation.date < new Date(existing.firstGiftDate)) existing.firstGiftDate = donation.date.toISOString();
    if (donation.date > new Date(existing.lastGiftDate)) existing.lastGiftDate = donation.date.toISOString();
    donors.set(donation.constituent.id, existing);
  }
  return Array.from(donors.values());
}

async function lifetimeGivingReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donors = await donorGivingRows(organizationId);
  const rows = donors
    .sort((a, b) => b.totalCents - a.totalCents || a.donorName.localeCompare(b.donorName))
    .map((donor) => ({
      ...donor,
      lifetimeTotal: dollars(donor.totalCents),
      largestGift: dollars(donor.largestGiftCents),
    }));
  return {
    ...emptyReport("lifetime-giving", "Lifetime giving report", "Donors with completed giving, including first, last, and largest gifts.", options),
    period: null,
    summary: [
      { label: "Lifetime giving", value: dollars(rows.reduce((total, row) => total + row.totalCents, 0)), type: "currency" },
      { label: "Giving donors", value: rows.length, type: "number" },
    ],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "lifetimeTotal", label: "Lifetime giving", type: "currency" },
      { key: "giftCount", label: "Gifts", type: "number" },
      { key: "firstGiftDate", label: "First gift", type: "date" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
      { key: "largestGift", label: "Largest gift", type: "currency" },
    ],
    rows,
    notices: ["Lifetime values are calculated from completed donation records, not a rounded dashboard display."],
  };
}

async function monthlyGivingReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donors = await donorGivingRows(organizationId, { gte: options.from, lte: options.through });
  const rows = donors
    .sort((a, b) => b.totalCents - a.totalCents || a.donorName.localeCompare(b.donorName))
    .map((donor) => ({ ...donor, totalAmount: dollars(donor.totalCents) }));
  return {
    ...emptyReport("monthly-giving", "Monthly giving report", "Donor giving within the selected reporting period. Set one calendar month for a monthly view.", options),
    summary: [
      { label: "Gift total", value: dollars(rows.reduce((total, row) => total + row.totalCents, 0)), type: "currency" },
      { label: "Donors", value: rows.length, type: "number" },
      { label: "Gifts", value: rows.reduce((total, row) => total + row.giftCount, 0), type: "number" },
    ],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "giftCount", label: "Gifts", type: "number" },
      { key: "totalAmount", label: "Gift total", type: "currency" },
      { key: "firstGiftDate", label: "First gift", type: "date" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
    ],
    rows,
    notices: [],
  };
}

async function constituentDirectory(organizationId: string) {
  return prisma.constituent.findMany({
    where: { organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      organizationName: true,
      email: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      doNotMail: true,
      donorStatus: true,
      notes: true,
      firstGiftDate: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      giftCount: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
    orderBy: [{ organizationName: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

type CohortMetrics = {
  numberOfDonors: number;
  totalRevenueCents: number;
  numberOfGifts: number;
  averageRevenuePerDonor: number;
  averageRevenuePerGift: number;
  averageGiftsPerDonor: number;
  donorsWithTwoOrMoreGifts: number;
};

function cohortMetrics(entries: Array<{ totalCents: number; giftCount: number }>): CohortMetrics {
  const numberOfDonors = entries.length;
  const totalRevenueCents = entries.reduce((total, entry) => total + entry.totalCents, 0);
  const numberOfGifts = entries.reduce((total, entry) => total + entry.giftCount, 0);
  return {
    numberOfDonors,
    totalRevenueCents,
    numberOfGifts,
    averageRevenuePerDonor: numberOfDonors ? dollars(totalRevenueCents) / numberOfDonors : 0,
    averageRevenuePerGift: numberOfGifts ? dollars(totalRevenueCents) / numberOfGifts : 0,
    averageGiftsPerDonor: numberOfDonors ? numberOfGifts / numberOfDonors : 0,
    donorsWithTwoOrMoreGifts: entries.filter((entry) => entry.giftCount >= 2).length,
  };
}

function cohortMatrixRows(current: CohortMetrics, prior: CohortMetrics, twoYearsPrior: CohortMetrics) {
  return [
    { label: "Number of donors", current: current.numberOfDonors, prior: prior.numberOfDonors, twoYearsPrior: twoYearsPrior.numberOfDonors, difference: current.numberOfDonors - prior.numberOfDonors, type: "number" as const },
    { label: "Total revenue", current: dollars(current.totalRevenueCents), prior: dollars(prior.totalRevenueCents), twoYearsPrior: dollars(twoYearsPrior.totalRevenueCents), difference: dollars(current.totalRevenueCents - prior.totalRevenueCents), type: "currency" as const },
    { label: "Number of gifts", current: current.numberOfGifts, prior: prior.numberOfGifts, twoYearsPrior: twoYearsPrior.numberOfGifts, difference: current.numberOfGifts - prior.numberOfGifts, type: "number" as const },
    { label: "Average revenue per donor", current: current.averageRevenuePerDonor, prior: prior.averageRevenuePerDonor, twoYearsPrior: twoYearsPrior.averageRevenuePerDonor, type: "currency" as const },
    { label: "Average revenue per gift", current: current.averageRevenuePerGift, prior: prior.averageRevenuePerGift, twoYearsPrior: twoYearsPrior.averageRevenuePerGift, type: "currency" as const },
    { label: "Average gifts per donor", current: current.averageGiftsPerDonor, prior: prior.averageGiftsPerDonor, twoYearsPrior: twoYearsPrior.averageGiftsPerDonor, type: "decimal" as const },
    { label: "Donors with 2+ gifts", current: current.donorsWithTwoOrMoreGifts, prior: prior.donorsWithTwoOrMoreGifts, twoYearsPrior: twoYearsPrior.donorsWithTwoOrMoreGifts, type: "number" as const },
  ];
}

async function comprehensiveDonorReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const currentYear = options.selectedYear;
  const priorYear = currentYear - 1;
  const twoYearsPrior = currentYear - 2;
  const earliestRange = selectedYearRange(options, twoYearsPrior);
  const currentRange = selectedYearRange(options, currentYear);
  const start = earliestRange.gte;
  const through = currentRange.lt;
  const donations = await prisma.donation.findMany({
    where: completedDonationWhere(organizationId, { gte: start, lt: through }),
    select: {
      amount: true,
      date: true,
      constituent: { select: { id: true, firstGiftDate: true } },
    },
  });
  const byYear = new Map<number, Map<string, { totalCents: number; giftCount: number; firstGiftDate: Date | null }>>();
  for (const year of [twoYearsPrior, priorYear, currentYear]) byYear.set(year, new Map());
  for (const donation of donations) {
    const year = reportingYearForDate(options, donation.date);
    const entries = byYear.get(year);
    if (!entries) continue;
    const entry = entries.get(donation.constituent.id) ?? { totalCents: 0, giftCount: 0, firstGiftDate: donation.constituent.firstGiftDate };
    entry.totalCents += cents(donation.amount);
    entry.giftCount += 1;
    entries.set(donation.constituent.id, entry);
  }
  const sections = [
    { label: "Active donors", select: (_entry: { firstGiftDate: Date | null }) => true },
    { label: "New donors", select: (entry: { firstGiftDate: Date | null }, year: number) => entry.firstGiftDate ? reportingYearForDate(options, entry.firstGiftDate) === year : false },
    { label: "Repeat donors", select: (entry: { firstGiftDate: Date | null }, year: number) => entry.firstGiftDate ? reportingYearForDate(options, entry.firstGiftDate) !== year : true },
  ].map((section) => {
    const metricsFor = (year: number) => cohortMetrics(Array.from(byYear.get(year)?.values() ?? []).filter((entry) => section.select(entry, year)));
    return {
      label: section.label,
      rows: cohortMatrixRows(metricsFor(currentYear), metricsFor(priorYear), metricsFor(twoYearsPrior)),
    };
  });
  const activeCurrent = sections[0].rows;
  return {
    ...emptyReport("comprehensive-donor-analysis", "Comprehensive donor analysis", "Three-year active, new, and repeat donor comparison based on completed gifts and each donor’s first-gift date.", options),
    period: { from: start.toISOString(), through: new Date(through.getTime() - 1).toISOString(), label: `${options.dateBasis === "fiscal" ? "FY " : ""}${twoYearsPrior}–${currentYear}` },
    summary: [
      { label: "Current-year donors", value: activeCurrent[0]?.current ?? 0, type: "number" },
      { label: "Current-year revenue", value: activeCurrent[1]?.current ?? 0, type: "currency" },
      { label: "Current-year gifts", value: activeCurrent[2]?.current ?? 0, type: "number" },
    ],
    columns: [],
    rows: [],
    comparisonMatrix: { columns: { currentYear, priorYear, twoYearsPrior }, sections },
    notices: [`New donors made their first completed gift in the displayed ${options.dateBasis} year. Repeat donors gave in that year and had an earlier first gift.`],
  };
}

async function donorFilesReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const directory = await constituentDirectory(organizationId);
  const rows = directory.map((donor) => ({
    donorId: donor.id,
    donorName: donorName(donor),
    email: donor.email,
    phone: donor.phone,
    address: [donor.addressLine1, donor.addressLine2, [donor.city, donor.state, donor.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—",
    mailPreference: donor.doNotMail ? "Do not mail" : "Mail permitted",
    lifetimeGiving: dollars(cents(donor.totalLifetimeGiving)),
  }));
  return {
    ...emptyReport("donor-files", "Donor files", "A current donor directory with contact and mailing-preference details.", options),
    period: null,
    summary: [{ label: "Donor files", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "mailPreference", label: "Mail preference" },
      { key: "lifetimeGiving", label: "Lifetime giving", type: "currency" },
    ],
    rows,
    notices: ["Do not mail preferences are included so printed/exported lists can be reviewed before communication."],
  };
}

async function givingCapacityInterestReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const directory = await constituentDirectory(organizationId);
  const rows = directory
    .filter((donor) => donor.tags.length > 0)
    .map((donor) => ({
      donorId: donor.id,
      donorName: donorName(donor),
      tags: donor.tags.map((entry) => entry.tag.name).sort().join(", "),
      lifetimeGiving: dollars(cents(donor.totalLifetimeGiving)),
      lastGiftDate: iso(donor.lastGiftDate),
        donorStatus: donor.donorStatus.replace(/_/g, " "),
    }))
    .sort((a, b) => b.lifetimeGiving - a.lifetimeGiving || a.donorName.localeCompare(b.donorName));
  return {
    ...emptyReport("giving-capacity-interest", "Donor files by giving capacity and interest", "Donors grouped by the interest and capacity tags currently recorded in OyamaCRM.", options),
    period: null,
    summary: [{ label: "Tagged donors", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "tags", label: "Interest / capacity tags" },
      { key: "donorStatus", label: "Donor status" },
      { key: "lifetimeGiving", label: "Lifetime giving", type: "currency" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
    ],
    rows,
    notices: ["OyamaCRM currently stores interest and capacity information as donor tags. No separate capacity score is inferred by this report."],
  };
}

async function donorFollowUpReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      type: "FOLLOW_UP",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      status: true,
      constituent: { select: { id: true, firstName: true, lastName: true, displayName: true, organizationName: true, email: true } },
      assignee: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
  });
  const rows = tasks.map((task) => ({
    taskId: task.id,
    donorId: task.constituent?.id ?? null,
    donorName: task.constituent ? donorName(task.constituent) : "Unlinked task",
    task: task.title,
    dueDate: iso(task.dueDate),
    priority: task.priority,
    status: task.status.replace(/_/g, " "),
    assignee: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}`.trim() || task.assignee.email || "Unassigned" : "Unassigned",
  }));
  return {
    ...emptyReport("donor-follow-up", "Donor follow-up", "Open donor follow-up tasks, ordered by due date and priority.", options),
    period: null,
    summary: [
      { label: "Open follow-ups", value: rows.length, type: "number" },
      { label: "Overdue", value: rows.filter((row) => row.dueDate && new Date(row.dueDate) < new Date()).length, type: "number" },
    ],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "task", label: "Follow-up" },
      { key: "dueDate", label: "Due date", type: "date" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "assignee", label: "Assigned to" },
    ],
    rows,
    notices: ["Only open tasks explicitly marked Follow-up are included."],
  };
}

async function donorNotesReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const directory = await constituentDirectory(organizationId);
  const rows = directory
    .filter((donor) => Boolean(donor.notes?.trim()))
    .map((donor) => ({
      donorId: donor.id,
      donorName: donorName(donor),
      notes: donor.notes?.trim() ?? "",
      lastGiftDate: iso(donor.lastGiftDate),
      lifetimeGiving: dollars(cents(donor.totalLifetimeGiving)),
    }));
  return {
    ...emptyReport("donor-notes", "Donor notes", "A list of the profile notes stored on donor files.", options),
    period: null,
    summary: [{ label: "Donors with notes", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "notes", label: "Profile notes" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
      { key: "lifetimeGiving", label: "Lifetime giving", type: "currency" },
    ],
    rows,
    notices: ["This report contains the donor profile Notes field. Timeline activity notes are not yet included."],
  };
}

async function firstTimeDonorsReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const directory = await constituentDirectory(organizationId);
  const firstTime = directory.filter((donor) => donor.firstGiftDate && donor.firstGiftDate >= options.from && donor.firstGiftDate <= options.through);
  const rows = firstTime
    .map((donor) => ({
      donorId: donor.id,
      donorName: donorName(donor),
      email: donor.email,
      firstGiftDate: iso(donor.firstGiftDate),
      firstGiftAmount: donor.lastGiftDate?.getTime() === donor.firstGiftDate?.getTime() ? dollars(cents(donor.lastGiftAmount)) : null,
      lifetimeGiving: dollars(cents(donor.totalLifetimeGiving)),
      giftCount: donor.giftCount,
    }))
    .sort((a, b) => String(a.firstGiftDate).localeCompare(String(b.firstGiftDate)) || a.donorName.localeCompare(b.donorName));
  return {
    ...emptyReport("first-time-donors", "First time donors", "Donors whose first completed gift falls in the selected date range.", options),
    summary: [{ label: "First-time donors", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "firstGiftDate", label: "First gift", type: "date" },
      { key: "firstGiftAmount", label: "Only gift amount", type: "currency" },
      { key: "lifetimeGiving", label: "Lifetime giving", type: "currency" },
      { key: "giftCount", label: "Gifts", type: "number" },
    ],
    rows,
    notices: ["The only-gift amount is shown only when the donor has exactly one recorded completed gift."],
  };
}

async function lapsedDonorsReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const selectedRange = selectedYearRange(options, options.selectedYear);
  const priorRange = selectedYearRange(options, options.selectedYear - 1);
  const selectedStart = selectedRange.gte;
  const selectedEnd = selectedRange.lt;
  const priorStart = priorRange.gte;
  const priorGiving = await donorGivingRows(organizationId, { gte: priorStart, lt: selectedStart });
  const currentDonorIds = new Set((await prisma.donation.findMany({
    where: completedDonationWhere(organizationId, { gte: selectedStart, lt: selectedEnd }),
    select: { constituentId: true },
    distinct: ["constituentId"],
  })).map((donation) => donation.constituentId));
  const rows = priorGiving
    .filter((donor) => !currentDonorIds.has(donor.donorId))
    .sort((a, b) => b.totalCents - a.totalCents)
    .map((donor) => ({
      donorId: donor.donorId,
      donorName: donor.donorName,
      email: donor.email,
      priorYearGiving: dollars(donor.totalCents),
      priorYearGifts: donor.giftCount,
      lastGiftDate: donor.lastGiftDate,
      selectedYear: options.selectedYear,
    }));
  return {
    ...emptyReport("lapsed-donors", `Lapsed donors (SYBUNTY) · ${options.dateBasis === "fiscal" ? "FY " : ""}${options.selectedYear}`, `Donors who gave in the prior ${options.dateBasis} year but have not given in the selected ${options.dateBasis} year.`, options),
    period: { from: selectedStart.toISOString(), through: new Date(selectedEnd.getTime() - 1).toISOString(), label: `${options.dateBasis === "fiscal" ? "FY " : ""}${options.selectedYear}` },
    summary: [{ label: "Lapsed donors", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "priorYearGiving", label: "Prior-year giving", type: "currency" },
      { key: "priorYearGifts", label: "Prior-year gifts", type: "number" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
    ],
    rows,
    notices: ["SYBUNTY means gave Some Year But Unfortunately Not This Year. The selected year controls this comparison."],
  };
}

async function neverGivenReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donors = await prisma.constituent.findMany({
    where: {
      organizationId,
      donations: { none: { status: "COMPLETED" } },
    },
    select: { id: true, firstName: true, lastName: true, displayName: true, organizationName: true, email: true, phone: true, createdAt: true, donorStatus: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = donors.map((donor) => ({
    donorId: donor.id,
    donorName: donorName(donor),
    email: donor.email,
    phone: donor.phone,
    donorStatus: donor.donorStatus.replace(/_/g, " "),
    fileCreated: donor.createdAt.toISOString(),
  }));
  return {
    ...emptyReport("never-given", "Never given report", "Donor files with no completed donation record.", options),
    period: null,
    summary: [{ label: "Donors without giving", value: rows.length, type: "number" }],
    columns: [
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "donorStatus", label: "Donor status" },
      { key: "fileCreated", label: "File created", type: "date" },
    ],
    rows,
    notices: [],
  };
}

async function topDonorsReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donors = await donorGivingRows(organizationId, { gte: options.from, lte: options.through });
  const rows = donors
    .sort((a, b) => b.totalCents - a.totalCents || a.donorName.localeCompare(b.donorName))
    .slice(0, options.limit)
    .map((donor, index) => ({
      rank: index + 1,
      donorId: donor.donorId,
      donorName: donor.donorName,
      email: donor.email,
      totalGiving: dollars(donor.totalCents),
      giftCount: donor.giftCount,
      largestGift: dollars(donor.largestGiftCents),
      lastGiftDate: donor.lastGiftDate,
    }));
  return {
    ...emptyReport("top-donors", "Top donors", "Top donors by completed giving in the selected date range.", options),
    summary: [
      { label: "Donors shown", value: rows.length, type: "number" },
      { label: "Giving shown", value: rows.reduce((total, row) => total + cents(row.totalGiving), 0) / 100, type: "currency" },
    ],
    columns: [
      { key: "rank", label: "Rank", type: "number" },
      { key: "donorName", label: "Donor", linkToDonor: true },
      { key: "email", label: "Email" },
      { key: "totalGiving", label: "Total giving", type: "currency" },
      { key: "giftCount", label: "Gifts", type: "number" },
      { key: "largestGift", label: "Largest gift", type: "currency" },
      { key: "lastGiftDate", label: "Last gift", type: "date" },
    ],
    rows,
    notices: [],
  };
}

async function paymentMethodSummaryReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({
    where: baseDonationWhere(organizationId, options),
    select: { amount: true, paymentMethod: true, constituentId: true },
  });
  const groups = new Map<PaymentMethod, { giftCount: number; totalCents: number; donors: Set<string> }>();
  for (const donation of donations) {
    const group = groups.get(donation.paymentMethod) ?? { giftCount: 0, totalCents: 0, donors: new Set<string>() };
    group.giftCount += 1;
    group.totalCents += cents(donation.amount);
    group.donors.add(donation.constituentId);
    groups.set(donation.paymentMethod, group);
  }
  const totalCents = donations.reduce((total, donation) => total + cents(donation.amount), 0);
  const rows = Array.from(groups.entries()).map(([method, group]) => ({
    paymentMethod: String(method).replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
    giftCount: group.giftCount,
    donorCount: group.donors.size,
    totalAmount: dollars(group.totalCents),
    shareOfGiving: totalCents ? Math.round((group.totalCents / totalCents) * 1000) / 10 : 0,
  })).sort((a, b) => b.totalAmount - a.totalAmount);
  return {
    ...emptyReport("payment-method-summary", "Payment method summary", "Completed gifts grouped by payment method for the selected date range.", options),
    summary: [{ label: "Gift total", value: dollars(totalCents), type: "currency" }, { label: "Gifts", value: donations.length, type: "number" }, { label: "Payment methods", value: rows.length, type: "number" }],
    columns: [{ key: "paymentMethod", label: "Payment method" }, { key: "giftCount", label: "Gifts", type: "number" }, { key: "donorCount", label: "Donors", type: "number" }, { key: "totalAmount", label: "Total giving", type: "currency" }, { key: "shareOfGiving", label: "Share of giving (%)", type: "number" }],
    rows,
    notices: [],
  };
}

async function designationPerformanceReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({
    where: baseDonationWhere(organizationId, options),
    select: { amount: true, designation: { select: { id: true, name: true } }, constituentId: true },
  });
  const groups = new Map<string, { designation: string; giftCount: number; totalCents: number; donors: Set<string> }>();
  for (const donation of donations) {
    const key = donation.designation?.id ?? "general";
    const group = groups.get(key) ?? { designation: donation.designation?.name ?? "General / undesignated", giftCount: 0, totalCents: 0, donors: new Set<string>() };
    group.giftCount += 1;
    group.totalCents += cents(donation.amount);
    group.donors.add(donation.constituentId);
    groups.set(key, group);
  }
  const totalCents = donations.reduce((total, donation) => total + cents(donation.amount), 0);
  const rows = Array.from(groups.values()).map((group) => ({ designation: group.designation, giftCount: group.giftCount, donorCount: group.donors.size, totalAmount: dollars(group.totalCents), shareOfGiving: totalCents ? Math.round((group.totalCents / totalCents) * 1000) / 10 : 0 })).sort((a, b) => b.totalAmount - a.totalAmount);
  return {
    ...emptyReport("designation-performance", "Designation performance", "Completed giving grouped by fund or designation for the selected date range.", options),
    summary: [{ label: "Gift total", value: dollars(totalCents), type: "currency" }, { label: "Gifts", value: donations.length, type: "number" }, { label: "Designations", value: rows.length, type: "number" }],
    columns: [{ key: "designation", label: "Designation" }, { key: "giftCount", label: "Gifts", type: "number" }, { key: "donorCount", label: "Donors", type: "number" }, { key: "totalAmount", label: "Total giving", type: "currency" }, { key: "shareOfGiving", label: "Share of giving (%)", type: "number" }],
    rows,
    notices: [],
  };
}

async function crmPerformanceScorecardReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const durationMs = Math.max(24 * 60 * 60 * 1000, options.through.getTime() - options.from.getTime() + 1);
  const priorThrough = new Date(options.from.getTime() - 1);
  const priorFrom = new Date(priorThrough.getTime() - durationMs + 1);
  const [current, prior] = await Promise.all([
    prisma.donation.findMany({ where: baseDonationWhere(organizationId, options), select: { amount: true, constituentId: true, isRecurring: true } }),
    prisma.donation.findMany({ where: completedDonationWhere(organizationId, { gte: priorFrom, lte: priorThrough }), select: { amount: true, constituentId: true, isRecurring: true } }),
  ]);
  const totals = (donations: typeof current) => ({
    revenue: donations.reduce((sum, donation) => sum + cents(donation.amount), 0),
    gifts: donations.length,
    donors: new Set(donations.map((donation) => donation.constituentId)).size,
    recurring: donations.filter((donation) => donation.isRecurring).length,
  });
  const currentTotals = totals(current);
  const priorTotals = totals(prior);
  const metricRows = [
    { metric: "Giving revenue", current: dollars(currentTotals.revenue), prior: dollars(priorTotals.revenue), type: "currency" as const },
    { metric: "Completed gifts", current: currentTotals.gifts, prior: priorTotals.gifts, type: "number" as const },
    { metric: "Giving donors", current: currentTotals.donors, prior: priorTotals.donors, type: "number" as const },
    { metric: "Recurring gifts", current: currentTotals.recurring, prior: priorTotals.recurring, type: "number" as const },
  ].map((row) => ({ ...row, change: row.current - row.prior, changePercent: row.prior ? Math.round(((row.current - row.prior) / row.prior) * 1000) / 10 : null }));
  const positiveSignals = metricRows.filter((row) => row.change > 0).length;
  const performanceScore = Math.round((positiveSignals / metricRows.length) * 100);
  return {
    ...emptyReport("crm-performance-scorecard", "CRM performance scorecard", "Period performance compared with the immediately preceding period of the same length.", options),
    summary: [
      { label: "Giving revenue", value: dollars(currentTotals.revenue), type: "currency" },
      { label: "Giving donors", value: currentTotals.donors, type: "number" },
      { label: "Positive signals", value: `${positiveSignals} of ${metricRows.length}`, type: "text" },
      { label: "Performance score", value: `${performanceScore}/100`, type: "text" },
    ],
    columns: [],
    rows: [],
    comparisonMatrix: {
      columns: { currentYear: options.selectedYear, priorYear: options.selectedYear - 1, twoYearsPrior: options.selectedYear - 2 },
      labels: { current: "Selected period", prior: "Prior equal period", twoYearsPrior: "" },
      sections: [{ label: "Period performance", rows: metricRows.map((row) => ({ label: row.metric, current: row.current, prior: row.prior, twoYearsPrior: 0, difference: row.change, type: row.type })) }],
    },
    notices: [`Comparison period: ${period(priorFrom, priorThrough)?.label ?? "prior equal period"}. Revenue uses currency; count-based rows are labeled in the insights view.`],
  };
}

async function recurringGivingReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({ where: baseDonationWhere(organizationId, options), select: donationSelection, orderBy: { date: "desc" } });
  const recurring = donations.filter((donation) => donation.isRecurring);
  const byDonor = new Map<string, { donorId: string; donorName: string; email: string | null; giftCount: number; totalCents: number; lastGiftDate: string }>();
  for (const donation of recurring) {
    const row = byDonor.get(donation.constituent.id) ?? { donorId: donation.constituent.id, donorName: donorName(donation.constituent), email: donation.constituent.email, giftCount: 0, totalCents: 0, lastGiftDate: donation.date.toISOString() };
    row.giftCount += 1;
    row.totalCents += cents(donation.amount);
    if (donation.date.toISOString() > row.lastGiftDate) row.lastGiftDate = donation.date.toISOString();
    byDonor.set(donation.constituent.id, row);
  }
  const rows = Array.from(byDonor.values()).sort((a, b) => b.totalCents - a.totalCents).map((row) => ({ ...row, totalAmount: dollars(row.totalCents) }));
  return {
    ...emptyReport("recurring-giving", "Recurring giving", "Donors and gift activity marked recurring in the selected date range.", options),
    summary: [{ label: "Recurring gifts", value: recurring.length, type: "number" }, { label: "Recurring giving", value: dollars(recurring.reduce((sum, donation) => sum + cents(donation.amount), 0)), type: "currency" }, { label: "Recurring donors", value: rows.length, type: "number" }],
    columns: [{ key: "donorName", label: "Donor", linkToDonor: true }, { key: "email", label: "Email" }, { key: "giftCount", label: "Recurring gifts", type: "number" }, { key: "totalAmount", label: "Recurring giving", type: "currency" }, { key: "lastGiftDate", label: "Last gift", type: "date" }],
    rows,
    notices: ["Recurring status reflects the donation record flag and does not predict future gifts."],
  };
}

async function campaignPerformanceReport(organizationId: string, options: DonorLibraryReportOptions): Promise<DonorLibraryReport> {
  const donations = await prisma.donation.findMany({ where: baseDonationWhere(organizationId, options), select: { amount: true, constituentId: true, campaign: { select: { name: true } } } });
  const groups = new Map<string, { campaign: string; giftCount: number; totalCents: number; donors: Set<string> }>();
  for (const donation of donations) {
    const campaign = donation.campaign?.name ?? "Unattributed campaign";
    const row = groups.get(campaign) ?? { campaign, giftCount: 0, totalCents: 0, donors: new Set<string>() };
    row.giftCount += 1;
    row.totalCents += cents(donation.amount);
    row.donors.add(donation.constituentId);
    groups.set(campaign, row);
  }
  const rows = Array.from(groups.values()).sort((a, b) => b.totalCents - a.totalCents).map((row) => ({ campaign: row.campaign, giftCount: row.giftCount, donorCount: row.donors.size, totalAmount: dollars(row.totalCents) }));
  return {
    ...emptyReport("campaign-performance", "Campaign performance", "Completed giving attributed to campaigns in the selected date range.", options),
    summary: [{ label: "Campaign giving", value: dollars(donations.reduce((sum, donation) => sum + cents(donation.amount), 0)), type: "currency" }, { label: "Campaigns", value: rows.length, type: "number" }, { label: "Gifts", value: donations.length, type: "number" }],
    columns: [{ key: "campaign", label: "Campaign" }, { key: "giftCount", label: "Gifts", type: "number" }, { key: "donorCount", label: "Donors", type: "number" }, { key: "totalAmount", label: "Total giving", type: "currency" }],
    rows,
    notices: [],
  };
}

export async function buildDonorLibraryReport(
  organizationId: string | null,
  report: DonorLibraryReportKey,
  options: DonorLibraryReportOptions,
): Promise<DonorLibraryReport> {
  if (!organizationId) {
    return {
      ...emptyReport(report, "Donor report", "No organization is configured for this report.", options),
      notices: ["Select an organization before running a donor report."],
    };
  }

  switch (report) {
    case "batch-receipts": return donationRowsReport(organizationId, "batch-receipts", options);
    case "unacknowledged-gifts": return unacknowledgedGiftsReport(organizationId, options);
    case "donations": return donationRowsReport(organizationId, "donations", options);
    case "donations-by-designation": return donorsByDesignationReport(organizationId, options);
    case "lifetime-giving": return lifetimeGivingReport(organizationId, options);
    case "monthly-giving": return monthlyGivingReport(organizationId, options);
    case "comprehensive-donor-analysis": return comprehensiveDonorReport(organizationId, options);
    case "donor-files": return donorFilesReport(organizationId, options);
    case "giving-capacity-interest": return givingCapacityInterestReport(organizationId, options);
    case "donor-follow-up": return donorFollowUpReport(organizationId, options);
    case "donor-notes": return donorNotesReport(organizationId, options);
    case "first-time-donors": return firstTimeDonorsReport(organizationId, options);
    case "lapsed-donors": return lapsedDonorsReport(organizationId, options);
    case "never-given": return neverGivenReport(organizationId, options);
    case "top-donors": return topDonorsReport(organizationId, options);
    case "payment-method-summary": return paymentMethodSummaryReport(organizationId, options);
    case "designation-performance": return designationPerformanceReport(organizationId, options);
    case "crm-performance-scorecard": return crmPerformanceScorecardReport(organizationId, options);
    case "recurring-giving": return recurringGivingReport(organizationId, options);
    case "campaign-performance": return campaignPerformanceReport(organizationId, options);
  }
}
