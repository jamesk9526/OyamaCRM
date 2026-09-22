type TaxDetailInput = {
  amount?: unknown;
  taxDeductible?: unknown;
  taxDeductibleAmount?: unknown;
};

type ExistingTaxDetails = {
  amount: unknown;
  taxDeductible: boolean;
  taxDeductibleAmount: unknown | null;
};

function toMoneyNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function resolveDonationTaxDetails(
  input: TaxDetailInput,
  existing?: ExistingTaxDetails,
): { taxDeductible: boolean; taxDeductibleAmount: number } {
  const giftAmount = toMoneyNumber(input.amount ?? existing?.amount, "Gift amount");
  const taxDeductible = typeof input.taxDeductible === "boolean"
    ? input.taxDeductible
    : existing?.taxDeductible ?? true;

  if (!taxDeductible) {
    return { taxDeductible, taxDeductibleAmount: 0 };
  }

  const hasExplicitAmount = input.taxDeductibleAmount !== undefined
    && input.taxDeductibleAmount !== null
    && input.taxDeductibleAmount !== "";

  let taxDeductibleAmount: number;
  if (hasExplicitAmount) {
    taxDeductibleAmount = toMoneyNumber(input.taxDeductibleAmount, "Tax-deductible amount");
  } else if (!existing || !existing.taxDeductible || existing.taxDeductibleAmount == null) {
    taxDeductibleAmount = giftAmount;
  } else {
    const previousGiftAmount = toMoneyNumber(existing.amount, "Gift amount");
    const previousTaxAmount = toMoneyNumber(existing.taxDeductibleAmount, "Tax-deductible amount");
    taxDeductibleAmount = input.amount !== undefined && previousTaxAmount === previousGiftAmount
      ? giftAmount
      : previousTaxAmount;
  }

  if (taxDeductibleAmount > giftAmount) {
    throw new Error("Tax-deductible amount cannot exceed the gift amount.");
  }

  return { taxDeductible, taxDeductibleAmount };
}
