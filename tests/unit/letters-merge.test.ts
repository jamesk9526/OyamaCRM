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

  it("supports fallback filters and highlighted missing fields", () => {
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
    expect(output).toContain("Missing: {{donor.addressBlock}}");
    expect(Array.from(missingFields)).toEqual(["donor.addressBlock"]);
  });

  it("falls back to first name when last name is missing", () => {
    const missingFields = new Set<string>();
    const output = renderMergeFields(
      "Dear {{ donor.firstName }} {{ donor.lastName }},",
      {
        "donor.firstName": "Ava",
        "donor.lastName": "",
      },
      { missingMode: "highlight", missingFields },
    );

    expect(output).toBe("Dear Ava Ava,");
    expect(Array.from(missingFields)).toEqual([]);
  });

  it("contains core donor and gift merge tokens", () => {
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donor.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{constituent.firstName}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{gift.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{donation.amount}}");
    expect(SUPPORTED_LETTER_MERGE_FIELDS).toContain("{{organization.name}}");
  });
});
