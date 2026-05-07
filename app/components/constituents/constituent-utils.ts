export type ConstituentRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  type: string;
  donorStatus: string;
  totalLifetimeGiving: string;
  totalYtdGiving: string;
  lastGiftDate: string | null;
  lastGiftAmount: string | null;
  giftCount: number;
  engagementScore: number;
  tags: Array<{ tagId: string; tag: { name: string; color: string } }>;
};

export const CONSTITUENT_TYPES = [
  "DONOR", "VOLUNTEER", "MEMBER", "PROSPECT",
  "SPONSOR", "BOARD_MEMBER", "FOUNDATION", "ORGANIZATION",
] as const;

export const DONOR_STATUSES = ["NEW", "ACTIVE", "LAPSED", "MAJOR_DONOR", "DECEASED"] as const;

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

export function statusColor(status: string): string {
  switch (status) {
    case "MAJOR_DONOR": return "bg-green-100 text-green-800";
    case "ACTIVE": return "bg-blue-100 text-blue-800";
    case "LAPSED": return "bg-amber-100 text-amber-800";
    case "NEW": return "bg-purple-100 text-purple-800";
    case "DECEASED": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function typeLabel(type: string): string {
  return type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusLabel(status: string): string {
  if (status === "MAJOR_DONOR") return "Major Donor";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function engagementColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}
