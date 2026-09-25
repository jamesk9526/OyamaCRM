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
  if (value === "" || value === null || typeof value === "boolean") {
    throw new Error(`${label} must be a non-negative number.`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) {
    throw new Error(`${label} must have at most two decimal places.`);
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

export function sumTaxDeductibleGiving(
  gifts: Array<{ amount: unknown; taxDeductible: boolean; taxDeductibleAmount: unknown | null }>,
): number {
  const cents = gifts.reduce((sum, gift) => {
    if (!gift.taxDeductible) return sum;
    const amount = gift.taxDeductibleAmount ?? gift.amount;
    return sum + Math.round(toMoneyNumber(amount, "Tax-deductible amount") * 100);
  }, 0);
  return cents / 100;
}
