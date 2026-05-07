/**
 * Unit tests for `app/components/donations/donation-utils.ts`.
 * Covers currency/date formatting, payment-method label lookup,
 * status colour mapping, and constant catalogues used by donation forms.
 */
import { describe, expect, it } from "vitest";
import {
  DONATION_STATUSES,
  PAYMENT_METHODS,
  formatCurrency,
  formatDate,
  methodLabel,
  statusColor,
} from "@/app/components/donations/donation-utils";

describe("donation-utils", () => {
  describe("formatCurrency", () => {
    it("formats numeric values as USD with no fraction digits", () => {
      expect(formatCurrency(1234.5)).toBe("$1,235");
      expect(formatCurrency("99.99")).toBe("$100");
    });

    it("returns $0 for null/undefined/NaN inputs", () => {
      expect(formatCurrency(null)).toBe("$0");
      expect(formatCurrency(undefined)).toBe("$0");
      expect(formatCurrency("not-a-number")).toBe("$0");
    });
  });

  describe("formatDate", () => {
    it("returns em-dash for missing values", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
    });

    it("formats an ISO date as a short locale date", () => {
      const out = formatDate("2025-03-14T00:00:00.000Z");
      // Cross-platform locales may produce slightly different separators,
      // so just verify the year and month tokens are present.
      expect(out).toMatch(/2025/);
      expect(out).toMatch(/Mar/);
    });
  });

  describe("methodLabel", () => {
    it("maps known payment methods to friendly labels", () => {
      expect(methodLabel("CREDIT_CARD")).toBe("Credit Card");
      expect(methodLabel("ACH")).toBe("ACH");
      expect(methodLabel("WIRE")).toBe("Wire Transfer");
      expect(methodLabel("IN_KIND")).toBe("In-Kind");
    });

    it("returns the raw value for unknown methods", () => {
      expect(methodLabel("CRYPTO")).toBe("CRYPTO");
    });
  });

  describe("statusColor", () => {
    it("returns distinct tailwind tokens per status", () => {
      expect(statusColor("COMPLETED")).toContain("green");
      expect(statusColor("PENDING")).toContain("amber");
      expect(statusColor("FAILED")).toContain("red");
      expect(statusColor("REFUNDED")).toContain("gray");
    });

    it("falls back to gray for unknown statuses", () => {
      expect(statusColor("WEIRD")).toContain("gray");
    });
  });

  describe("constant catalogues", () => {
    it("PAYMENT_METHODS includes the offline gift methods used by batch entry", () => {
      for (const m of ["CHECK", "CASH", "STOCK", "IN_KIND"]) {
        expect(PAYMENT_METHODS).toContain(m);
      }
    });

    it("DONATION_STATUSES covers the full lifecycle", () => {
      expect(DONATION_STATUSES).toEqual([
        "PENDING",
        "COMPLETED",
        "FAILED",
        "REFUNDED",
      ]);
    });
  });
});
