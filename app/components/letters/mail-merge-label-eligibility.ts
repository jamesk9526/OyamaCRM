export interface LabelEligibilityRecipient {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  doNotMail?: boolean | null;
  doNotContact?: boolean | null;
}

export type LabelEligibilityKind =
  | "ready"
  | "partial"
  | "do-not-contact"
  | "do-not-mail"
  | "all-contact-and-mail"
  | "missing-street"
  | "suppression-overridden";

export interface LabelEligibility {
  ready: boolean;
  reason: string;
  kind: LabelEligibilityKind;
}

export function isLabelSuppressed(row: LabelEligibilityRecipient): boolean {
  return Boolean(row.doNotContact || row.doNotMail);
}

export function getLabelEligibility(row: LabelEligibilityRecipient, ignoreSuppressions = false): LabelEligibility {
  if (!ignoreSuppressions) {
    if (row.doNotContact && row.doNotMail) {
      return { ready: false, reason: "Do not contact + do not mail", kind: "all-contact-and-mail" };
    }
    if (row.doNotContact) return { ready: false, reason: "Do not contact", kind: "do-not-contact" };
    if (row.doNotMail) return { ready: false, reason: "Do not mail", kind: "do-not-mail" };
  }
  if (!row.addressLine1?.trim()) return { ready: false, reason: "No street address", kind: "missing-street" };
  if (ignoreSuppressions && isLabelSuppressed(row)) {
    return { ready: true, reason: "Mail suppression overridden for this label PDF", kind: "suppression-overridden" };
  }
  return row.city?.trim() && row.state?.trim() && row.zip?.trim()
    ? { ready: true, reason: "Mail ready", kind: "ready" }
    : { ready: true, reason: "Partial address", kind: "partial" };
}

export function unavailableLabelReasonSummary(rows: LabelEligibilityRecipient[], ignoreSuppressions = false): string {
  const counts = new Map<LabelEligibilityKind, number>();
  for (const row of rows) {
    const status = getLabelEligibility(row, ignoreSuppressions);
    if (!status.ready) counts.set(status.kind, (counts.get(status.kind) ?? 0) + 1);
  }
  const parts = [
    ["all-contact-and-mail", "both Do Not Contact and Do Not Mail"],
    ["do-not-contact", "Do Not Contact"],
    ["do-not-mail", "Do Not Mail"],
    ["missing-street", "no street address"],
  ] as const;
  return parts
    .map(([kind, label]) => counts.get(kind) ? `${counts.get(kind)} ${label}` : null)
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
