// Unit tests for the Compassion CRM client import validator + CSV parser improvements.
// Covers the garbage-row guards, the "Name(Preferred)" parser, in-file duplicate detection,
// and the new auto-delimiter detection in csvParser.

import { describe, expect, it } from "vitest";
import {
  validateAndTransformClients,
  isGarbageName,
  splitNameAndPreferred,
  splitFullName,
  isValidEmail,
  isValidPhone,
  isValidDate,
  issuesToCsv,
  type FieldMapping,
} from "@/app/compassion/import/clients/clientImportValidator";
import { parseCSV, detectDelimiter } from "@/app/data-tools/import/csvParser";

// ─── isGarbageName ────────────────────────────────────────────────────────────

describe("isGarbageName", () => {
  it("treats normal human names as not-garbage", () => {
    expect(isGarbageName("Miranda")).toBe(false);
    expect(isGarbageName("O'Brien")).toBe(false);
    expect(isGarbageName("Jean-Paul")).toBe(false);
  });

  it("rejects the eKYROS report-widget metadata example from the bug report", () => {
    const junk = "Text,Aurora,False,Active,No,Not Applicable, Active";
    expect(isGarbageName(junk)).toBe(true);
  });

  it("rejects rows beginning with widget/control tokens", () => {
    expect(isGarbageName("Text,Foo")).toBe(true);
    expect(isGarbageName("True")).toBe(true);
    expect(isGarbageName("Report Generated 05/09/2026")).toBe(true);
    expect(isGarbageName("page 2 of 10")).toBe(true);
    expect(isGarbageName("Total")).toBe(true);
  });

  it("rejects strings that are mostly digits / dashes", () => {
    expect(isGarbageName("— — 05/09/2026")).toBe(true);
    expect(isGarbageName("123-456-7890")).toBe(true);
  });

  it("rejects strings that contain the eKYROS em-dash separator", () => {
    expect(isGarbageName("Active — — Unassigned")).toBe(true);
  });

  it("rejects reserved single-token placeholders", () => {
    expect(isGarbageName("test")).toBe(true);
    expect(isGarbageName("UNKNOWN")).toBe(true);
    expect(isGarbageName("placeholder")).toBe(true);
  });

  it("ignores empty strings", () => {
    expect(isGarbageName("")).toBe(false);
    expect(isGarbageName("   ")).toBe(false);
  });
});

// ─── splitNameAndPreferred ────────────────────────────────────────────────────

describe("splitNameAndPreferred", () => {
  it("parses Name(Preferred) without a space", () => {
    expect(splitNameAndPreferred("Miranda Abrisz(Miranda)")).toEqual({
      full: "Miranda Abrisz",
      preferred: "Miranda",
    });
  });

  it("parses Name (Preferred) with a space", () => {
    expect(splitNameAndPreferred("Miranda Abrisz (Mira)")).toEqual({
      full: "Miranda Abrisz",
      preferred: "Mira",
    });
  });

  it("parses middle quoted nickname patterns", () => {
    expect(splitNameAndPreferred(`Robert "Bob" Smith`)).toEqual({
      full: "Robert Smith",
      preferred: "Bob",
    });
    expect(splitNameAndPreferred("Robert 'Bob' Smith")).toEqual({
      full: "Robert Smith",
      preferred: "Bob",
    });
  });

  it("returns plain names unchanged", () => {
    expect(splitNameAndPreferred("Jane Doe")).toEqual({ full: "Jane Doe" });
  });

  it("ignores parentheses that contain spaces (not a nickname)", () => {
    expect(splitNameAndPreferred("Foo Bar (Some long phrase)")).toEqual({
      full: "Foo Bar (Some long phrase)",
    });
  });
});

// ─── splitFullName ────────────────────────────────────────────────────────────

describe("splitFullName", () => {
  it("splits two-token names into first and last", () => {
    expect(splitFullName("Jane Doe")).toEqual({ firstName: "Jane", lastName: "Doe" });
  });

  it("puts everything after the first token into lastName", () => {
    expect(splitFullName("Mary Anne Smith Jones")).toEqual({
      firstName: "Mary",
      lastName: "Anne Smith Jones",
    });
  });

  it("uses the single token for both fields when only one is supplied", () => {
    expect(splitFullName("Cher")).toEqual({ firstName: "Cher", lastName: "Cher" });
  });
});

// ─── format / validity helpers ────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.example.org")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a,b@c.com")).toBe(false);
  });
  it("treats empty as valid (optional field)", () => {
    expect(isValidEmail("")).toBe(true);
  });
});

describe("isValidPhone", () => {
  it("accepts US 10-digit numbers in any format", () => {
    expect(isValidPhone("(303) 555-1212")).toBe(true);
    expect(isValidPhone("3035551212")).toBe(true);
  });
  it("rejects strings with too few digits", () => {
    expect(isValidPhone("12345")).toBe(false);
  });
  it("treats empty as valid", () => {
    expect(isValidPhone("")).toBe(true);
  });
});

describe("isValidDate", () => {
  it("accepts ISO and US formats", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
    expect(isValidDate("01/15/2024")).toBe(true);
  });
  it("rejects junk strings", () => {
    expect(isValidDate("not-a-date")).toBe(false);
  });
  it("rejects years way out of range", () => {
    expect(isValidDate("0001-01-01")).toBe(false);
    expect(isValidDate("3650-01-01")).toBe(false);
  });
});

// ─── validateAndTransformClients ──────────────────────────────────────────────

const baseMapping: FieldMapping = {
  FullName: "fullName",
  FirstName: "firstName",
  LastName: "lastName",
  Email: "email",
  HomePhone: "phone",
  Status: "clientStatus",
  Birthdate: "dateOfBirth",
};

describe("validateAndTransformClients", () => {
  it("rejects the bug-report garbage row example", () => {
    const rows = [
      // Real client
      {
        FullName: "", FirstName: "Miranda", LastName: "Abrisz",
        Email: "miranda@example.com", HomePhone: "303-555-1212", Status: "Active", Birthdate: "1990-01-01",
      },
      // The exact garbage pattern from the user report
      {
        FullName: "", FirstName: "Text,Aurora,False,Active,No,Not Applicable, Active",
        LastName: "", Email: "", HomePhone: "", Status: "", Birthdate: "",
      },
    ];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].firstName).toBe("Miranda");
    expect(result.counts.skippedGarbage).toBe(1);
    expect(result.issues.some((i) => i.code === "GARBAGE_NAME")).toBe(true);
  });

  it("derives firstName/lastName/preferredName from a 'Full(Preferred)' field", () => {
    const rows = [{
      FullName: "Miranda Abrisz(Miranda)",
      FirstName: "", LastName: "", Email: "", HomePhone: "", Status: "Active", Birthdate: "",
    }];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid[0].firstName).toBe("Miranda");
    expect(result.valid[0].lastName).toBe("Abrisz");
    expect(result.valid[0].preferredName).toBe("Miranda");
  });

  it("drops invalid emails but keeps the row (warning, not error)", () => {
    const rows = [{
      FullName: "", FirstName: "Jane", LastName: "Doe",
      Email: "not-an-email", HomePhone: "", Status: "", Birthdate: "",
    }];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email).toBeUndefined();
    expect(result.issues.some((i) => i.code === "INVALID_EMAIL")).toBe(true);
  });

  it("flags rows with no name as MISSING_NAME and skips them", () => {
    const rows = [{
      FullName: "", FirstName: "", LastName: "",
      Email: "", HomePhone: "", Status: "", Birthdate: "",
    }];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid).toHaveLength(0);
    expect(result.counts.skippedMissingName).toBe(1);
    expect(result.issues[0].code).toBe("MISSING_NAME");
  });

  it("detects in-file duplicates by email and surfaces a warning", () => {
    const rows = [
      { FullName: "", FirstName: "Jane", LastName: "Doe", Email: "j@x.com", HomePhone: "", Status: "", Birthdate: "" },
      { FullName: "", FirstName: "Jane", LastName: "D",    Email: "j@x.com", HomePhone: "", Status: "", Birthdate: "" },
    ];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid).toHaveLength(2); // duplicates are still imported, just flagged
    expect(result.counts.duplicatesInFile).toBe(1);
    expect(result.issues.some((i) => i.code === "DUPLICATE_IN_FILE")).toBe(true);
  });

  it("normalises status values via CLIENT_STATUS_MAP and warns on unrecognised values", () => {
    const rows = [
      { FullName: "", FirstName: "A", LastName: "A", Email: "", HomePhone: "", Status: "Closed", Birthdate: "" },
      { FullName: "", FirstName: "B", LastName: "B", Email: "", HomePhone: "", Status: "Bogus",  Birthdate: "" },
    ];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid[0].clientStatus).toBe("ARCHIVED");
    expect(result.valid[1].clientStatus).toBe("ACTIVE"); // fallback
    expect(result.issues.some((i) => i.code === "STATUS_UNRECOGNISED")).toBe(true);
  });

  it("drops invalid dateOfBirth and warns", () => {
    const rows = [{
      FullName: "", FirstName: "A", LastName: "B",
      Email: "", HomePhone: "", Status: "", Birthdate: "not-a-date",
    }];
    const result = validateAndTransformClients(rows, baseMapping);
    expect(result.valid[0].dateOfBirth).toBeUndefined();
    expect(result.issues.some((i) => i.code === "INVALID_DATE")).toBe(true);
  });
});

// ─── issuesToCsv ──────────────────────────────────────────────────────────────

describe("issuesToCsv", () => {
  it("produces a header row and one line per issue with proper escaping", () => {
    const csv = issuesToCsv([
      { row: 1, field: "email", severity: "warning", code: "INVALID_EMAIL", message: 'bad, value', rawValue: 'a"b' },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Row,Severity,Code,Field,Message,Raw Value");
    expect(lines[1]).toContain('"bad, value"');
    expect(lines[1]).toContain('"a""b"');
  });
});

// ─── csvParser delimiter detection ────────────────────────────────────────────

describe("detectDelimiter", () => {
  it("detects comma-separated content", () => {
    expect(detectDelimiter(["a,b,c", "1,2,3", "4,5,6"])).toBe(",");
  });
  it("detects tab-separated content (TSV)", () => {
    expect(detectDelimiter(["a\tb\tc", "1\t2\t3", "4\t5\t6"])).toBe("\t");
  });
  it("detects semicolon-separated content", () => {
    expect(detectDelimiter(["a;b;c", "1;2;3", "4;5;6"])).toBe(";");
  });
  it("detects pipe-separated content", () => {
    expect(detectDelimiter(["a|b|c", "1|2|3", "4|5|6"])).toBe("|");
  });
});

describe("parseCSV with auto-delimiter", () => {
  it("parses TSV without an explicit delimiter argument", () => {
    const result = parseCSV("First\tLast\tEmail\nJane\tDoe\tj@x.com\n");
    expect(result.delimiter).toBe("\t");
    expect(result.headers).toEqual(["First", "Last", "Email"]);
    expect(result.rows[0]).toEqual({ First: "Jane", Last: "Doe", Email: "j@x.com" });
  });

  it("strips a UTF-8 BOM and handles CRLF line endings", () => {
    const result = parseCSV("\uFEFFa,b\r\n1,2\r\n");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("respects an explicit delimiter override", () => {
    const result = parseCSV("a;b\n1;2", ";");
    expect(result.delimiter).toBe(";");
    expect(result.headers).toEqual(["a", "b"]);
  });

  it("parses quoted multiline cells without shifting columns", () => {
    const csv = [
      "DirID,Address,City,State",
      '1,"300 8th Street',
      'Apt. A",Monett,MO',
    ].join("\n");
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["DirID", "Address", "City", "State"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      DirID: "1",
      Address: "300 8th Street\nApt. A",
      City: "Monett",
      State: "MO",
    });
  });
});
