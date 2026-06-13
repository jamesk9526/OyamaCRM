/** Unit tests for letters merge-field helpers. */
import { describe, expect, it } from "vitest";
import {
  collectMergeFieldKeys,
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

  it("contains core donor and gift merge tokens", () => {
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donor.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.organizationName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.contactFullName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donor.displayName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{gift.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donation.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{organization.name}}");
  });
});
