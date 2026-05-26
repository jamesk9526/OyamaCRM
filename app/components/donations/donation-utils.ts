export type DonationRow = {
  id: string;
  amount: string;
  date: string;
  acknowledgmentSentAt?: string | null;
  paymentMethod: string;
  status: string;
  isRecurring: boolean;
  frequency?: string | null;
  receiptNumber?: string | null;
  taxDeductible: boolean;
  notes?: string | null;
  constituent: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  };
  campaign?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
};

export const PAYMENT_METHODS = [
  "CREDIT_CARD", "ACH", "CHECK", "WIRE", "STOCK", "IN_KIND", "CASH", "ONLINE",
] as const;

export const DONATION_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const;

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Formats donation calendar dates without timezone drift.
 * Donation `date` is date-only business data, so render in UTC calendar terms.
 */
export function formatDonationDate(value: string | null | undefined): string {
  if (!value) return "—";

  const ymd = parseYmd(value.slice(0, 10));
  if (ymd) {
    const utcDate = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
    return utcDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function methodLabel(method: string): string {
  const map: Record<string, string> = {
    CREDIT_CARD: "Credit Card", ACH: "ACH", CHECK: "Check",
    WIRE: "Wire Transfer", STOCK: "Stock", IN_KIND: "In-Kind", CASH: "Cash", ONLINE: "Online",
  };
  return map[method] ?? method;
}

export function statusColor(status: string): string {
  switch (status) {
    case "COMPLETED": return "bg-green-100 text-green-700";
    case "PENDING":   return "bg-amber-100 text-amber-700";
    case "FAILED":    return "bg-red-100 text-red-700";
    case "REFUNDED":  return "bg-gray-100 text-gray-600";
    default:          return "bg-gray-100 text-gray-600";
  }
}
