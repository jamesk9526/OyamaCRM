import { describe, expect, it } from "vitest";
import { positivePage, updateBrowseQuery } from "@/app/features/donor-workspace/browse-query";
describe("donor browse query", () => {
  it("preserves supporter context and resets pagination when narrowing a ledger", () => {
    const next = new URLSearchParams(updateBrowseQuery("constituentId=donor-1&campaignId=appeal-2&page=4", { acknowledgment: "pending", status: "" }));
    expect(Object.fromEntries(next)).toEqual({ constituentId: "donor-1", campaignId: "appeal-2", acknowledgment: "pending" });
  });
  it("keeps pagination and encoded searches on explicit page navigation", () => {
    const next = new URLSearchParams(updateBrowseQuery("search=A%26B", { page: "2" }, false));
    expect(next.get("search")).toBe("A&B"); expect(next.get("page")).toBe("2");
  });
  it.each([null, "-1", "0", "3.5", "NaN", "Infinity", "9007199254740992"])("rejects invalid page %s", (page) => expect(positivePage(page)).toBe(1));
  it("accepts positive whole pages", () => expect(positivePage("42")).toBe(42));
});
