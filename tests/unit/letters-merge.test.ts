/** Unit tests for letters merge-field helpers. */
import { describe, expect, it } from "vitest";
import {
  collectMergeFieldKeys,
  COMPATIBILITY_LETTER_MERGE_FIELDS,
  renderMergeFields,
  SUPPORTED_LETTER_MERGE_FIELDS,
  unsupportedMergeFieldKeys,
} from "@/server/src/services/letters-merge";

describe("letters-merge", () => {
  it("collects unique merge field keys from multiple content blocks", () => {
    const keys = collectMergeFieldKeys(
      "Hello {{ donor.firstName }} {{gift.amount}}",
      "Again {{gift.amount}} and {{organization.name}}",
      null,
      undefined,
    );

    expect(keys).toEqual(["donor.firstName", "gift.amount", "organization.name"]);
  });

  it("detects unsupported merge field keys", () => {
    const keys = ["donor.firstName", "gift.amount", "custom.field"];
    const unsupported = unsupportedMergeFieldKeys(keys);
    expect(unsupported).toEqual(["custom.field"]);
  });

  it("renders supported placeholders and keeps unknown placeholders untouched", () => {
    const output = renderMergeFields(
      "Hi {{ donor.firstName }}, amount {{ gift.amount }}. Unknown {{ custom.field }}",
      {
        "donor.firstName": "Jules",
        "gift.amount": "$100.00",
      },
    );

    expect(output).toContain("Hi Jules");
    expect(output).toContain("amount $100.00");
    expect(output).toContain("{{custom.field}}");
  });

  it("supports fallback filters and tracks missing fields without inline missing markers", () => {
    const missingFields = new Set<string>();
    const output = renderMergeFields(
      "Dear {{ constituent.firstName | fallback:\"Friend\" }} {{ donor.addressBlock }}",
      {
        "donor.firstName": "",
        "donor.addressBlock": "",
      },
      { missingMode: "highlight", missingFields },
    );

    expect(output).toContain("Dear Friend");
    expect(output).not.toContain("Missing: {{donor.addressBlock}}");
    expect(Array.from(missingFields)).toEqual(["donor.addressBlock"]);
  });

  it("does not replace a missing last name with the first name", () => {
    const missingFields = new Set<string>();
    const output = renderMergeFields(
      "Dear {{ donor.firstName }} {{ donor.lastName }},",
      {
        "donor.firstName": "Ava",
        "donor.lastName": "",
      },
      { missingMode: "highlight", missingFields },
    );

    expect(output).toBe("Dear Ava ,");
    expect(Array.from(missingFields)).toEqual(["donor.lastName"]);
  });

  it("keeps donor first name and last name distinct", () => {
    const output = renderMergeFields(
      "Dear {{ donor.firstName }} {{ donor.lastName }}, legacy {{ constituent.firstName }} {{ constituent.lastName }}",
      {
        "donor.firstName": "Ava",
        "donor.lastName": "Taylor",
      },
    );

    expect(output).toBe("Dear Ava Taylor, legacy Ava Taylor");
  });

  it("renders simple brace aliases from canonical donor and gift values", () => {
    const keys = collectMergeFieldKeys("Dear {first} {last}, thank you for {amount} on {giftDate}.");
    const output = renderMergeFields(
      "Dear {first} {last}, thank you for {amount} on {giftDate}.",
      {
        "donor.firstName": "Ava",
        "donor.lastName": "Taylor",
        "gift.amount": "$125.00",
        "gift.date": "June 13, 2026",
      },
    );

    expect(keys).toEqual(["donor.firstName", "donor.lastName", "gift.amount", "gift.date"]);
    expect(output).toBe("Dear Ava Taylor, thank you for $125.00 on June 13, 2026.");
  });

  it("renders slash aliases and leaves unknown slash text unchanged", () => {
    const keys = collectMergeFieldKeys("Dear //first, //unknownAlias gave //amount.");
    const output = renderMergeFields(
      "Dear //first, //unknownAlias gave //amount.",
      {
        "donor.firstName": "Ava",
        "gift.amount": "$125.00",
      },
    );

    expect(keys).toEqual(["donor.firstName", "gift.amount", "unknownAlias"]);
    expect(unsupportedMergeFieldKeys(keys)).toEqual(["unknownAlias"]);
    expect(output).toBe("Dear Ava, //unknownAlias gave $125.00.");
  });

  it("supports filters on simple brace aliases", () => {
    const output = renderMergeFields(
      "Dear {preferred|fallback:\"Friend\"}, gift {amount|currency}.",
      {
        "donor.preferredName": "",
        "gift.amount": "125",
      },
    );

    expect(output).toBe("Dear Friend, gift $125.00.");
  });

  it("formats date filters as stored date-only values instead of local previous-day values", () => {
    const output = renderMergeFields(
      "Gift date: {{ gift.date | date:\"MM/dd/yyyy\" }} / {{ gift.date | date:\"long\" }}",
      {
        "gift.date": "2026-06-29T00:00:00.000Z",
      },
    );

    expect(output).toBe("Gift date: 06/29/2026 / June 29, 2026");
  });

  it("renders canonical gift amount and gift date on the same line", () => {
    const keys = collectMergeFieldKeys(
      "Gift line: {{gift.amount}} on {{gift.date}}. Adjacent: {{gift.amount}}{{gift.date}}.",
    );
    const output = renderMergeFields(
      "Gift line: {{gift.amount}} on {{gift.date}}. Adjacent: {{gift.amount}}{{gift.date}}.",
      {
        "gift.amount": "$125.00",
        "gift.date": "June 13, 2026",
      },
    );

    expect(keys).toEqual(["gift.amount", "gift.date"]);
    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("Gift line: $125.00 on June 13, 2026. Adjacent: $125.00June 13, 2026.");
  });

  it("renders donation compatibility aliases for amount and date on the same line", () => {
    const keys = collectMergeFieldKeys("Donation line: {{donation.amount}} on {{donation.date}}.");
    const output = renderMergeFields(
      "Donation line: {{donation.amount}} on {{donation.date}}.",
      {
        "gift.amount": "$321.45",
        "gift.date": "June 29, 2026",
      },
    );

    expect(keys).toEqual(["gift.amount", "gift.date"]);
    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("Donation line: $321.45 on June 29, 2026.");
  });

  it("renders advertised shorthand amount and date aliases in double-brace form", () => {
    const keys = collectMergeFieldKeys("Gift shorthand: {{amount}} {{giftAmount}} {{date}} {{giftDate}}.");
    const output = renderMergeFields(
      "Gift shorthand: {{amount}} {{giftAmount}} {{date}} {{giftDate}}.",
      {
        "gift.amount": "$50.00",
        "gift.date": "July 7, 2026",
      },
    );

    expect(keys).toEqual(["gift.amount", "gift.date"]);
    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("Gift shorthand: $50.00 $50.00 July 7, 2026 July 7, 2026.");
  });

  it("renders donor-prefixed compatibility aliases shared with email templates", () => {
    const keys = collectMergeFieldKeys("Dear {{donor.first}} {{donor.last}}, {{donor.name}} gave on {{donor.giftDate}}.");
    const output = renderMergeFields(
      "Dear {{donor.first}} {{donor.last}}, {{donor.name}} gave on {{donor.giftDate}}.",
      {
        "donor.firstName": "Ava",
        "donor.lastName": "Taylor",
        "donor.fullName": "Ava Taylor",
        "gift.date": "July 7, 2026",
      },
    );

    expect(keys).toEqual(["donor.firstName", "donor.fullName", "donor.lastName", "gift.date"]);
    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("Dear Ava Taylor, Ava Taylor gave on July 7, 2026.");
  });

  it("renders email-style compatibility aliases used by shared communication helpers", () => {
    const keys = collectMergeFieldKeys(
      "{{organizationName}} {{organizationPhone}} {{organizationWebsite}} {{organizationTaxId}} {{staffName}} {{staff.name}} {{staffTitle}} {{staffEmail}} {{campaignName}} {{currentYear}} {{currentDate}}",
    );
    const output = renderMergeFields(
      "{{organizationName}} {{organizationPhone}} {{organizationWebsite}} {{organizationTaxId}} {{staffName}} {{staff.name}} {{staffTitle}} {{staffEmail}} {{campaignName}} {{currentYear}} {{currentDate}}",
      {
        "organization.name": "The Pregnancy Care Center",
        "organization.phone": "417-678-0090",
        "organization.website": "www.thepregnancycarecenter.com",
        "organization.taxId": "12-3456789",
        "staff.fullName": "Rebecca Haine",
        "staff.title": "Executive Director",
        "staff.email": "contact@thepregnancycarecenter.com",
        "gift.campaign": "Spring Appeal",
        "year": "2026",
        "currentDate": "June 16, 2026",
      },
    );

    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("The Pregnancy Care Center 417-678-0090 www.thepregnancycarecenter.com 12-3456789 Rebecca Haine Rebecca Haine Executive Director contact@thepregnancycarecenter.com Spring Appeal 2026 June 16, 2026");
  });

  it("renders common gift summary aliases from canonical gift and year values", () => {
    const keys = collectMergeFieldKeys(
      "{{donationAmount}} {{lastGiftAmount}} {{receiptNumber}} {{taxDeductibleAmount}} {{totalYtdGiving}} {{giftCount}} {{firstGiftDate}} {{lastGiftDate}}",
    );
    const output = renderMergeFields(
      "{{donationAmount}} {{lastGiftAmount}} {{receiptNumber}} {{taxDeductibleAmount}} {{totalYtdGiving}} {{giftCount}} {{firstGiftDate}} {{lastGiftDate}}",
      {
        "gift.amount": "$42.50",
        "gift.receiptNumber": "R-100",
        "gift.taxDeductibleAmount": "$42.50",
        "year.totalGiving": "$500.00",
        "year.numberOfGifts": "4",
        "year.firstGiftDate": "January 10, 2026",
        "year.lastGiftDate": "June 15, 2026",
      },
    );

    expect(unsupportedMergeFieldKeys(keys)).toEqual([]);
    expect(output).toBe("$42.50 $42.50 R-100 $42.50 $500.00 4 January 10, 2026 June 15, 2026");
  });

  it("contains core donor and gift merge tokens", () => {
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donor.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.organizationName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.contactFullName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donor.displayName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{gift.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donation.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{organization.name}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{currentDate}}");
    expect(COMPATIBILITY_LETTER_MERGE_FIELDS).toContain("{{organizationName}}");
    expect(COMPATIBILITY_LETTER_MERGE_FIELDS).toContain("{{giftAmount}}");
    expect(COMPATIBILITY_LETTER_MERGE_FIELDS).toContain("{{lastGiftAmount}}");
    expect(COMPATIBILITY_LETTER_MERGE_FIELDS).toContain("{{staff.name}}");
  });
});
