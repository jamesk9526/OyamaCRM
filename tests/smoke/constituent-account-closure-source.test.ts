import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("constituent account closure source contract", () => {
  it("enforces closed-account invisibility and exposes a guarded profile action", () => {
    const schema = read("prisma/schema.prisma");
    const prismaClient = read("server/src/lib/prisma.ts");
    const routes = read("server/src/routes/constituents.ts");
    const profile = read("app/constituents/[id]/page.tsx");
    const directory = read("app/constituents/page.tsx");
    const table = read("app/components/constituents/ConstituentTable.tsx");

    expect(schema).toContain("closedAt");
    expect(schema).toContain("closedReason");
    expect(prismaClient).toContain('params.model === "Constituent"');
    expect(prismaClient).toContain("closedAt: null");
    expect(routes).toContain('router.post("/:id/close"');
    expect(routes).toContain("CONSTITUENT_ACCOUNT_CLOSED");
    expect(routes).toContain("emailRecipientListMember.deleteMany");
    expect(routes).toContain('eligibilityStatus: "SKIPPED_DO_NOT_CONTACT"');
    expect(profile).toContain("Close account everywhere");
    expect(profile).toContain("Reason for closing");
    expect(directory).toContain("handleCloseAccount");
    expect(directory).toContain("/close");
    expect(table).toContain("Close account");
    expect(table).not.toContain("onDelete");
  });
});
