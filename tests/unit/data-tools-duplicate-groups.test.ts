import { describe, expect, it } from "vitest";
import { duplicateGroups, findDuplicates, oldestRecord, type MergeConstituent } from "../../app/data-tools/merge/MergeWorkflow";

describe("Data Tools duplicate groups", () => {
  const records: MergeConstituent[] = [
    { id: "oldest", createdAt: "2020-01-01T00:00:00.000Z", firstName: "Liz", lastName: "Brisindine", email: "shared@example.org", donorStatus: "ACTIVE" },
    { id: "middle", createdAt: "2022-01-01T00:00:00.000Z", firstName: "Elizabeth", lastName: "Brisindine", email: "shared@example.org", donorStatus: "ACTIVE" },
    { id: "newest", createdAt: "2024-01-01T00:00:00.000Z", firstName: "Elizabeth A", lastName: "Brisindine", email: "other@example.org", donorStatus: "ACTIVE" },
    { id: "unrelated", createdAt: "2019-01-01T00:00:00.000Z", firstName: "Jordan", lastName: "Lee", email: "jordan@example.org", donorStatus: "ACTIVE" },
  ];

  it("combines overlapping duplicate pairs into one merge group", () => {
    const groups = duplicateGroups(findDuplicates(records));

    expect(groups).toHaveLength(1);
    expect(groups[0].records.map((record) => record.id).sort()).toEqual(["middle", "newest", "oldest"]);
  });

  it("retains the record with the earliest creation timestamp", () => {
    expect(oldestRecord(records.slice(0, 3)).id).toBe("oldest");
  });
});
