import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import { loadClassicLetter } from "../../server/src/oyama-create/classic-letter";
import { defaultDesign } from "../../server/src/oyama-create/studio/design";
import { paragraph } from "../../server/src/oyama-create/studio/registry";

const req = { user: { sub: "fixture-staff", orgId: "fixture-org", role: "admin" } } as Request;
const contentForTest = () => db.createContent.findFirst({ where: { id: "fixture-content" }, include: { variants: true } });
beforeEach(async () => {
  resetCreateRows();
  await db.organization.create({ data: { id: "fixture-org", name: "Fictional organization" } });
  await db.organizationSettings.create({ data: { organizationId: "fixture-org", oyamaCreateClassicLettersEnabled: true } });
  await db.createCampaign.create({ data: { id: "fixture-campaign", organizationId: "fixture-org", name: "Fictional campaign", ownerId: "fixture-staff", channelsJson: ["LETTER"], audienceListIds: [] } });
  await db.createContent.create({ data: { id: "fixture-content", campaignId: "fixture-campaign", organizationId: "fixture-org", name: "Saved appeal", documentJson: { version: 1, blocks: [] } } });
  await db.createVariant.create({ data: { id: "fixture-variant", contentId: "fixture-content", organizationId: "fixture-org", channel: "LETTER", documentJson: {} } });
});

describe("classic Letter seeds", () => {
  it("loads saved shared copy and its aliases when an older draft has no native template", async () => {
    rows.createContent[0].documentJson = { version: 1, blocks: [{ id: "saved-copy", kind: "paragraph", text: "Latest saved draft for {first}." }] };
    const loaded = await loadClassicLetter(req, await contentForTest());
    expect(loaded.template.printBody).toContain("Latest saved draft for {first}.");
    expect(loaded.config.renderer).toBe("classic");
    expect(rows.letterTemplate).toHaveLength(0);
  });

  it("uses the accepted original name and body while marking older letterhead snapshots for comparison", async () => {
    rows.createVariant[0].legacyId = "original-letter";
    await db.letterTemplate.create({ data: { id: "original-letter", organizationId: "fixture-org", name: "Later standalone edit", printBody: "<p>Changed outside Create.</p>" } });
    await db.createImportSource.create({ data: { id: "accepted-source", organizationId: "fixture-org", campaignId: "fixture-campaign", contentId: "fixture-content", sourceType: "LETTER", sourceId: "original-letter", acceptedFingerprint: "accepted" } });
    await db.createImportSourceRevision.create({ data: { sourceId: "accepted-source", fingerprint: "accepted", snapshotJson: {
      record: { name: "Original November Letter", printBody: "<p>Dear {first} {last}, accepted copy.</p>" }, brand: { identity: { organizationDisplayName: "Accepted organization" } },
    } } });
    const loaded = await loadClassicLetter(req, await contentForTest());
    expect(loaded.template.name).toBe("Original November Letter");
    expect(loaded.template.printBody).toContain("accepted copy");
    expect(loaded.config.letterhead.branding.organizationName).toBe("Accepted organization");
    expect(loaded.config.reviewed).toBe(false);
    expect(loaded.config.diagnostics.join(" ")).toContain("letterhead snapshot");
  });

  it("carries the latest Studio Letter body and manual breaks into the classic canvas", async () => {
    const design = defaultDesign();
    design.body.content = [paragraph("latest-copy", "Latest saved Studio copy for {first}."), { type: "letterPageBreak", attrs: { studioId: "manual-break" } }, paragraph("continuation", "Continuation copy.")];
    rows.createContent[0].designJson = design;
    const loaded = await loadClassicLetter(req, await contentForTest());
    expect(loaded.config.renderer).toBe("studio");
    expect(loaded.template.printBody).toContain("Latest saved Studio copy");
    expect(loaded.template.printBody).toContain('data-letter-page-break="true"');
    expect(loaded.config.reviewed).toBe(false);
    expect(rows.letterTemplate).toHaveLength(0);
  });
});
