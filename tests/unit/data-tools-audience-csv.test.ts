import { describe, expect, it } from "vitest";
import { matchAudienceCsvRows } from "../../app/data-tools/AudienceCsvListTool";
import { parseCSV } from "../../app/data-tools/import/csvParser";

describe("Data Tools CSV audience matching", () => {
  const constituents = [
    { id: "older", firstName: "Elizabeth", lastName: "Brisindine", email: "elizabeth@example.org", phone: "417-555-0101", zip: "65705" },
    { id: "newer-duplicate", firstName: "Elizabeth", lastName: "Brisindine", email: "ELIZABETH@example.org", phone: "", zip: "65705" },
    { id: "phone-match", firstName: "Jordan", lastName: "Lee", phone: "(417) 555-0199" },
  ];

  it("matches every exact CRM record and deduplicates repeated CSV rows", () => {
    const parsed = parseCSV([
      "Email,Phone",
      "elizabeth@example.org,",
      "elizabeth@example.org,",
      ",4175550199",
      "missing@example.org,",
    ].join("\n"));

    const result = matchAudienceCsvRows(parsed, constituents);

    expect(result.constituentIds.sort()).toEqual(["newer-duplicate", "older", "phone-match"]);
    expect(result.matchedRows).toBe(3);
    expect(result.unmatchedRows).toBe(1);
  });

  it("matches a name and uses ZIP to avoid a conflicting record", () => {
    const parsed = parseCSV("First Name,Last Name,Postal Code\nElizabeth,Brisindine,65705");
    const result = matchAudienceCsvRows(parsed, [
      ...constituents,
      { id: "other-zip", firstName: "Elizabeth", lastName: "Brisindine", zip: "99999" },
    ]);

    expect(result.constituentIds.sort()).toEqual(["newer-duplicate", "older"]);
  });
});
