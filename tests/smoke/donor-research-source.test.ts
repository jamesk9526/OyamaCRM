import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("donor research product wiring", () => {
  it("mounts the permissioned API and the Donor CRM route", () => {
    const server = read("server/src/index.ts");
    const route = read("server/src/routes/donor-research.ts");
    const page = read("app/donor-research/page.tsx");

    expect(server).toContain('app.use("/api/donor-research", donorResearchRoutes)');
    expect(route).toContain('requirePermission("view:constituents")');
    expect(route).toContain('requirePermission("edit:constituents")');
    expect(route).toContain('status: "UNVERIFIED"');
    expect(page).toContain("DonorResearchWorkspace");
  });

  it("links research from navigation, the directory, and constituent profiles", () => {
    expect(read("app/components/layout/sidebar-configs.tsx")).toContain('href: "/donor-research"');
    expect(read("app/components/constituents/ConstituentTable.tsx")).toContain("/donor-research?constituentId=");
    expect(read("app/constituents/[id]/page.tsx")).toContain("Donor Research");
    expect(read("app/components/layout/AppShell.tsx")).toContain('"donor-research",');
  });

  it("keeps public lookups transient and prohibits automated wealth claims", () => {
    const route = read("server/src/routes/donor-research.ts");
    const workspace = read("app/components/donor-research/DonorResearchWorkspace.tsx");

    expect(route).toContain('transientLookup: true');
    expect(route).toContain('"Automated net-worth claims"');
    expect(workspace).toContain("Disclosed facts only");
    expect(workspace).toContain("Save for review");
  });
});
