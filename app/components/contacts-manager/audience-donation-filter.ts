export type DonationCountOperator = "ANY" | "EXACTLY" | "AT_LEAST" | "AT_MOST";

export interface AudienceDonationSummaryRow {
  constituentId: string;
  giftCount: number;
  totalAmount: number;
  firstGiftDate?: string | null;
  lastGiftDate?: string | null;
}

export function matchesDonationCount(giftCount: number, operator: DonationCountOperator, targetCount: number): boolean {
  const normalizedCount = Number.isFinite(giftCount) ? Math.max(0, Math.trunc(giftCount)) : 0;
  const normalizedTarget = Number.isFinite(targetCount) ? Math.max(0, Math.trunc(targetCount)) : 0;
  if (operator === "EXACTLY") return normalizedCount === normalizedTarget;
  if (operator === "AT_LEAST") return normalizedCount >= normalizedTarget;
  if (operator === "AT_MOST") return normalizedCount <= normalizedTarget;
  return true;
}

export function previousCalendarYear(now = new Date()): number {
  return now.getFullYear() - 1;
}
