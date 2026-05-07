/**
 * Unit tests for `app/components/constituents/constituent-utils.ts`.
 * Covers formatting helpers, donor-status color mapping, type/status labels,
 * engagement-score color buckets, and constant catalogues.
 */
import { describe, expect, it } from "vitest";
import {
  CONSTITUENT_TYPES,
  DONOR_STATUSES,
  engagementColor,
  formatCurrency,
  formatDate,
  statusColor,
  statusLabel,
  typeLabel,
} from "@/app/components/constituents/constituent-utils";

describe("constituent-utils", () => {
  describe("formatCurrency", () => {
    it("formats string and numeric amounts without fractional digits", () => {
      expect(formatCurrency("12500.5")).toBe("$12,501");
      expect(formatCurrency(0)).toBe("$0");
    });

    it("returns $0 for null/undefined/NaN", () => {
      expect(formatCurrency(null)).toBe("$0");
      expect(formatCurrency(undefined)).toBe("$0");
      expect(formatCurrency("oops")).toBe("$0");
    });
  });

  describe("formatDate", () => {
    it("returns em-dash for missing values", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate("")).toBe("—");
    });

    it("renders an ISO date string", () => {
      const out = formatDate("2024-12-01T00:00:00.000Z");
      expect(out).toMatch(/2024/);
    });
  });

  describe("statusColor", () => {
    it("highlights major donors in green and lapsed in amber", () => {
      expect(statusColor("MAJOR_DONOR")).toContain("green");
      expect(statusColor("LAPSED")).toContain("amber");
      expect(statusColor("ACTIVE")).toContain("blue");
      expect(statusColor("NEW")).toContain("purple");
      expect(statusColor("DECEASED")).toContain("gray");
    });

    it("falls back to gray for unknown values", () => {
      expect(statusColor("OTHER")).toContain("gray");
    });
  });

  describe("typeLabel", () => {
    it("replaces underscores with spaces and uppercases word starts", () => {
      // Current implementation only capitalizes word starts; remainder is left as-is.
      expect(typeLabel("BOARD_MEMBER")).toBe("BOARD MEMBER");
      expect(typeLabel("donor")).toBe("Donor");
      expect(typeLabel("foundation")).toBe("Foundation");
    });
  });

  describe("statusLabel", () => {
    it("returns 'Major Donor' as a special case", () => {
      expect(statusLabel("MAJOR_DONOR")).toBe("Major Donor");
    });

    it("title-cases other statuses", () => {
      expect(statusLabel("ACTIVE")).toBe("Active");
      expect(statusLabel("LAPSED")).toBe("Lapsed");
    });
  });

  describe("engagementColor", () => {
    it("returns green for high engagement (>=80)", () => {
      expect(engagementColor(95)).toContain("green");
      expect(engagementColor(80)).toContain("green");
    });

    it("returns amber for mid engagement (50–79)", () => {
      expect(engagementColor(70)).toContain("amber");
      expect(engagementColor(50)).toContain("amber");
    });

    it("returns red for low engagement (<50)", () => {
      expect(engagementColor(0)).toContain("red");
      expect(engagementColor(49)).toContain("red");
    });
  });

  describe("constant catalogues", () => {
    it("CONSTITUENT_TYPES covers nonprofit segments", () => {
      for (const t of [
        "DONOR",
        "VOLUNTEER",
        "MEMBER",
        "PROSPECT",
        "BOARD_MEMBER",
        "FOUNDATION",
      ]) {
        expect(CONSTITUENT_TYPES).toContain(t);
      }
    });

    it("DONOR_STATUSES include the new/active/lapsed/major lifecycle", () => {
      for (const s of ["NEW", "ACTIVE", "LAPSED", "MAJOR_DONOR"]) {
        expect(DONOR_STATUSES).toContain(s);
      }
    });
  });
});
