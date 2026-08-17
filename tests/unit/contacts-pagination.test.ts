import { describe, expect, it } from "vitest";
import { getContactsPagination } from "../../app/components/contacts-manager/contacts-pagination";

describe("Contacts Manager pagination", () => {
  it("creates five pages for 453 constituents shown 100 at a time", () => {
    expect(getContactsPagination(453, 100, 1)).toEqual({
      currentPage: 1,
      pageCount: 5,
      startIndex: 0,
      endIndex: 100,
      firstVisibleItem: 1,
      lastVisibleItem: 100,
    });
    expect(getContactsPagination(453, 100, 5)).toEqual({
      currentPage: 5,
      pageCount: 5,
      startIndex: 400,
      endIndex: 453,
      firstVisibleItem: 401,
      lastVisibleItem: 453,
    });
  });

  it("clamps stale pages after filtering reduces the result count", () => {
    expect(getContactsPagination(131, 100, 5)).toMatchObject({
      currentPage: 2,
      pageCount: 2,
      firstVisibleItem: 101,
      lastVisibleItem: 131,
    });
  });

  it("supports all-results and empty views", () => {
    expect(getContactsPagination(453, "ALL", 4)).toMatchObject({
      currentPage: 1,
      pageCount: 1,
      firstVisibleItem: 1,
      lastVisibleItem: 453,
    });
    expect(getContactsPagination(0, 100, 1)).toMatchObject({
      currentPage: 1,
      pageCount: 1,
      firstVisibleItem: 0,
      lastVisibleItem: 0,
    });
  });
});
