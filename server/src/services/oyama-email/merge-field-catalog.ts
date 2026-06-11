const EMAIL_MERGE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export type EmailMergeFieldGroupDescriptor = {
  key: string;
  label: string;
  availability: "always" | "donor" | "gift" | "event" | "steward";
  fields: Array<{
    token: string;
    description: string;
  }>;
};

export const EMAIL_MERGE_TOKEN_ALIASES: Record<string, string> = {
  "gift.taxDeductibleAmount": "taxDeductibleAmount",
  "donation.taxDeductibleAmount": "taxDeductibleAmount",
  "gift.amount": "donationAmount",
  "donation.amount": "donationAmount",
  "gift.receiptNumber": "receiptNumber",
  "donation.receiptNumber": "receiptNumber",
  "organization.address": "addressBlock",
  "organization.taxId": "organizationTaxId",
  "donor.preferredName": "preferredName",
  "donor.householdGreeting": "householdGreeting",
  "eventDate": "event.startDate",
  "eventStartDate": "event.startDate",
  "eventTime": "event.time",
  "eventLocation": "event.location",
  "eventName": "event.name",
  "preferencesUrl": "managePreferencesUrl",
  "preferences_url": "managePreferencesUrl",
  "unsubscribe_url": "unsubscribeUrl",
};

export const EMAIL_MERGE_FIELD_GROUPS: EmailMergeFieldGroupDescriptor[] = [
  {
    key: "personalization",
    label: "Personalization Fields",
    availability: "donor",
    fields: [
      { token: "{{preferredName}}", description: "Recommended first-name greeting" },
      { token: "{{householdGreeting}}", description: "Full-name household greeting" },
      { token: "{{firstName}}", description: "Recipient first name" },
      { token: "{{lastName}}", description: "Recipient last name" },
      { token: "{{fullName}}", description: "Recipient full name" },
      { token: "{{email}}", description: "Recipient email address" },
    ],
  },
  {
    key: "giving",
    label: "Giving Fields",
    availability: "gift",
    fields: [
      { token: "{{lastGiftAmount}}", description: "Most recent recorded gift amount" },
      { token: "{{lastGiftDate}}", description: "Most recent recorded gift date" },
      { token: "{{totalYtdGiving}}", description: "Year-to-date giving total" },
      { token: "{{totalLifetimeGiving}}", description: "Lifetime giving total" },
      { token: "{{giftCount}}", description: "Number of recorded gifts" },
      { token: "{{firstGiftDate}}", description: "First recorded gift date" },
      { token: "{{donationAmount}}", description: "Current gift amount in context" },
      { token: "{{taxDeductibleAmount}}", description: "Tax-deductible amount for the current gift" },
      { token: "{{receiptNumber}}", description: "Gift receipt number" },
    ],
  },
  {
    key: "organization",
    label: "Organization Fields",
    availability: "always",
    fields: [
      { token: "{{organizationName}}", description: "Organization display name" },
      { token: "{{organizationPhone}}", description: "Organization contact phone" },
      { token: "{{organizationWebsite}}", description: "Organization website URL" },
      { token: "{{addressBlock}}", description: "Organization mailing address" },
      { token: "{{organizationAddress}}", description: "Organization mailing address alias" },
      { token: "{{organizationTaxId}}", description: "Organization tax ID / EIN" },
      { token: "{{donationUrl}}", description: "Donation or primary action URL" },
    ],
  },
  {
    key: "campaign",
    label: "Campaign Fields",
    availability: "always",
    fields: [
      { token: "{{campaignName}}", description: "Campaign name" },
      { token: "{{campaignGoal}}", description: "Campaign goal amount" },
      { token: "{{campaignRaised}}", description: "Campaign raised amount" },
      { token: "{{campaignProgressPercent}}", description: "Campaign progress percentage" },
      { token: "{{campaignsSupported}}", description: "Most recent supported campaign name" },
      { token: "{{currentDate}}", description: "Current formatted date" },
      { token: "{{currentYear}}", description: "Current year" },
    ],
  },
  {
    key: "staff",
    label: "Staff Fields",
    availability: "always",
    fields: [
      { token: "{{staffName}}", description: "Sender name" },
      { token: "{{staffTitle}}", description: "Default signer or sender title" },
      { token: "{{staffEmail}}", description: "Sender email" },
      { token: "{{signatureName}}", description: "Signature display name" },
    ],
  },
  {
    key: "compliance",
    label: "Compliance Fields",
    availability: "always",
    fields: [
      { token: "{{unsubscribeUrl}}", description: "Generated unsubscribe URL" },
      { token: "{{managePreferencesUrl}}", description: "Generated preferences URL" },
    ],
  },
  {
    key: "event",
    label: "Event Fields",
    availability: "event",
    fields: [
      { token: "{{event.name}}", description: "Related event name" },
      { token: "{{event.startDate}}", description: "Related event start date" },
      { token: "{{event.time}}", description: "Related event start time" },
      { token: "{{event.location}}", description: "Related event location" },
    ],
  },
  {
    key: "steward",
    label: "Steward Path Fields",
    availability: "steward",
    fields: [
      { token: "{{stewardPath.name}}", description: "Steward path name" },
      { token: "{{stewardPath.status}}", description: "Steward path enrollment status" },
      { token: "{{stewardPath.currentStep}}", description: "Current steward step" },
      { token: "{{stewardPath.nextStepDueAt}}", description: "Next step due date" },
    ],
  },
  {
    key: "compatibility",
    label: "Compatibility / Advanced Fields",
    availability: "always",
    fields: [
      { token: "{{donor.firstName}}", description: "Compatibility alias for recipient first name" },
      { token: "{{donor.lastName}}", description: "Compatibility alias for recipient last name" },
      { token: "{{donor.fullName}}", description: "Compatibility alias for recipient full name" },
      { token: "{{donor.email}}", description: "Compatibility alias for recipient email" },
      { token: "{{donor.totalYtdGiving}}", description: "Compatibility alias for YTD giving" },
      { token: "{{donor.totalLifetimeGiving}}", description: "Compatibility alias for lifetime giving" },
      { token: "{{donor.giftCount}}", description: "Compatibility alias for gift count" },
      { token: "{{donor.firstGiftDate}}", description: "Compatibility alias for first gift date" },
      { token: "{{donor.lastGiftDate}}", description: "Compatibility alias for last gift date" },
      { token: "{{donor.lastGiftAmount}}", description: "Compatibility alias for last gift amount" },
      { token: "{{gift.amount}}", description: "Compatibility alias for gift amount" },
      { token: "{{gift.date}}", description: "Compatibility alias for gift date" },
      { token: "{{gift.receiptNumber}}", description: "Compatibility alias for gift receipt number" },
      { token: "{{gift.taxDeductibleAmount}}", description: "Compatibility alias for tax-deductible amount" },
      { token: "{{organization.name}}", description: "Compatibility alias for organization name" },
      { token: "{{organization.address}}", description: "Compatibility alias for organization address" },
      { token: "{{organization.taxId}}", description: "Compatibility alias for organization tax ID" },
      { token: "{{campaign.name}}", description: "Compatibility alias for campaign name" },
      { token: "{{campaign.goal}}", description: "Compatibility alias for campaign goal" },
      { token: "{{campaign.raised}}", description: "Compatibility alias for campaign raised amount" },
      { token: "{{campaign.progressPercent}}", description: "Compatibility alias for campaign progress percent" },
      { token: "{{eventDate}}", description: "Compatibility alias for event date" },
      { token: "{{eventTime}}", description: "Compatibility alias for event time" },
      { token: "{{eventLocation}}", description: "Compatibility alias for event location" },
      { token: "{{eventName}}", description: "Compatibility alias for event name" },
      { token: "{{staff.name}}", description: "Compatibility alias for sender name" },
      { token: "{{staff.email}}", description: "Compatibility alias for sender email" },
      { token: "{{preferencesUrl}}", description: "Compatibility alias for preferences URL" },
      { token: "{{preferences_url}}", description: "Compatibility alias for preferences URL" },
      { token: "{{unsubscribe_url}}", description: "Compatibility alias for unsubscribe URL" },
    ],
  },
];

function normalizeCatalogToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

export const EMAIL_SUPPORTED_MERGE_TOKENS = new Set<string>([
  ...EMAIL_MERGE_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => normalizeCatalogToken(field.token))),
  ...Object.keys(EMAIL_MERGE_TOKEN_ALIASES),
  ...Object.values(EMAIL_MERGE_TOKEN_ALIASES),
]);

export function canonicalizeEmailMergeToken(token: string): string {
  const normalized = token.trim();
  return EMAIL_MERGE_TOKEN_ALIASES[normalized] ?? normalized;
}

export function extractEmailMergeTokens(value: string): string[] {
  return Array.from(value.matchAll(EMAIL_MERGE_TOKEN_PATTERN), (match) => match[1]?.trim() || "").filter(Boolean);
}

export function findUnsupportedEmailMergeTokens(parts: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const token of extractEmailMergeTokens(part || "")) {
      const canonical = canonicalizeEmailMergeToken(token);
      if (!EMAIL_SUPPORTED_MERGE_TOKENS.has(canonical)) {
        tokens.add(token);
      }
    }
  }
  return Array.from(tokens).sort((a, b) => a.localeCompare(b));
}

export function findEmptyResolvedEmailMergeTokens(
  parts: Array<string | null | undefined>,
  vars: Record<string, string>,
): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const token of extractEmailMergeTokens(part || "")) {
      const canonical = canonicalizeEmailMergeToken(token);
      if (!EMAIL_SUPPORTED_MERGE_TOKENS.has(canonical)) {
        continue;
      }
      const exactValue = vars[token];
      const canonicalValue = vars[canonical];
      const resolved = typeof exactValue === "string" ? exactValue : canonicalValue;
      if (!String(resolved ?? "").trim()) {
        tokens.add(token);
      }
    }
  }
  return Array.from(tokens).sort((a, b) => a.localeCompare(b));
}

export function buildEmailMergePreviewWarnings(
  parts: Array<string | null | undefined>,
  vars: Record<string, string>,
): string[] {
  const warnings: string[] = [];
  const unsupported = findUnsupportedEmailMergeTokens(parts);
  if (unsupported.length > 0) {
    warnings.push(`Unsupported merge fields: ${unsupported.map((token) => `{{${token}}}`).join(", ")}.`);
  }
  const emptyResolved = findEmptyResolvedEmailMergeTokens(parts, vars);
  if (emptyResolved.length > 0) {
    warnings.push(`Preview data missing for: ${emptyResolved.map((token) => `{{${token}}}`).join(", ")}.`);
  }
  return warnings;
}
