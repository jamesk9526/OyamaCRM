import { describe, expect, it } from "vitest";
import {
  getConstituentContactFullName as getClientContactFullName,
  getConstituentDisplayName as getClientDisplayName,
  getConstituentSalutation as getClientSalutation,
  getConstituentSortName as getClientSortName,
  isOrganizationConstituent as isClientOrganization,
} from "@/app/components/constituents/constituent-utils";
import {
  getConstituentContactFullName as getServerContactFullName,
  getConstituentDisplayName as getServerDisplayName,
  getConstituentSalutation as getServerSalutation,
  getConstituentSortName as getServerSortName,
  isOrganizationConstituent as isServerOrganization,
} from "@/server/src/lib/constituent-identity";

type IdentityCase = {
  label: string;
  input: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    organizationName?: string | null;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    type?: string | null;
    entityKind?: string | null;
  };
};

const CASES: IdentityCase[] = [
  {
    label: "standard person",
    input: { firstName: "Maya", lastName: "Cole", type: "DONOR" },
  },
  {
    label: "person with display name override",
    input: { firstName: "Christopher", lastName: "Diaz", displayName: "Chris Diaz", type: "DONOR" },
  },
  {
    label: "organization by type",
    input: { type: "ORGANIZATION", organizationName: "Hope Church" },
  },
  {
    label: "organization by entityKind",
    input: { entityKind: "ORGANIZATION", displayName: "Aurora Foundation" },
  },
  {
    label: "organization fallback to first/last",
    input: { type: "FOUNDATION", firstName: "Legacy", lastName: "Trust" },
  },
  {
    label: "contact name available",
    input: { contactFirstName: "Alicia", contactLastName: "Wong", organizationName: "Summit Sponsors", type: "SPONSOR" },
  },
  {
    label: "missing name data",
    input: { type: "DONOR", firstName: "", lastName: "" },
  },
];

describe("server constituent identity parity", () => {
  it("matches client/server organization detection", () => {
    for (const testCase of CASES) {
      expect(isServerOrganization(testCase.input), testCase.label).toBe(isClientOrganization(testCase.input));
    }
  });

  it("matches client/server display name output", () => {
    for (const testCase of CASES) {
      expect(getServerDisplayName(testCase.input), testCase.label).toBe(getClientDisplayName(testCase.input));
    }
  });

  it("matches client/server sort name output", () => {
    for (const testCase of CASES) {
      expect(getServerSortName(testCase.input), testCase.label).toBe(getClientSortName(testCase.input));
    }
  });

  it("matches client/server contact full name output", () => {
    for (const testCase of CASES) {
      expect(getServerContactFullName(testCase.input), testCase.label).toBe(getClientContactFullName(testCase.input));
    }
  });

  it("matches client/server salutation output", () => {
    for (const testCase of CASES) {
      expect(getServerSalutation(testCase.input), testCase.label).toBe(getClientSalutation(testCase.input));
    }
  });
});
