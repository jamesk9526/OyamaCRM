import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("OYAMADonorPROFILE product wiring", () => {
  it("mounts the first-party permissioned API and canonical route", () => {
    const server = read("server/src/index.ts");
    const route = read("server/src/routes/donor-profile.ts");
    const researchRoute = read("server/src/routes/donor-profile-research.ts");
    const page = read("app/donor-profile/page.tsx");

    expect(server).toContain('app.use("/api/donor-profile", donorProfileResearchRoutes, donorProfileRoutes)');
    expect(route).toContain('requirePermission("view:constituents")');
    expect(route).toContain('requirePermission("edit:constituents")');
    expect(route).toContain('status: "UNVERIFIED"');
    expect(route).toContain('router.post("/identity/resolve"');
    expect(route).not.toContain("wealthengine");
    expect(researchRoute).toContain('router.post("/research"');
    expect(researchRoute).toContain("researchAutomaticDonorProfile");
    expect(page).toContain("AutomaticOyamaDonorProfileWorkspace");
    expect(read("app/donor-research/page.tsx")).toContain('redirect(`/donor-profile');
  });

  it("links research from navigation, the directory, and constituent profiles", () => {
    expect(read("app/components/layout/sidebar-configs.tsx")).toContain('href: "/donor-profile"');
    expect(read("app/components/constituents/ConstituentTable.tsx")).toContain("/donor-profile?constituentId=");
    expect(read("app/constituents/[id]/page.tsx")).toContain("OYAMADonorPROFILE");
    expect(read("app/components/layout/AppShell.tsx")).toContain('"donor-profile",');
  });

  it("keeps public evidence transient, reviewed, and vendor independent", () => {
    const route = read("server/src/routes/donor-profile.ts");
    const workspace = read("app/components/donor-profile/AutomaticOyamaDonorProfileWorkspace.tsx");

    expect(route).toContain('transientLookup: true');
    expect(route).toContain("OYAMA_DONOR_PROFILE_POLICY");
    expect(workspace).toContain("Research this constituent");
    expect(workspace).not.toContain("researchAutomaticDonorProfile");
    expect(workspace).toContain("No source form");
    expect(workspace).not.toContain("Foundation or nonprofit name");
    expect(workspace).toContain("Save as unverified");
    expect(workspace).not.toContain("WealthEngine");
  });
});
