import "dotenv/config";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import trash from "@/server/src/oyama-create/trash";
import campaigns from "@/server/src/oyama-create/campaigns";
import assets from "@/server/src/oyama-create/studio/assets";
import brandRoutes from "@/server/src/oyama-create/studio/brand-routes";
import { assertAvailableSelections } from "@/server/src/oyama-create/trash-selection";
import { assertCampaign, touchCampaign } from "@/server/src/oyama-create/access";
import { signAccessToken } from "@/server/src/lib/auth";
import { normalizeBrand } from "@/server/src/oyama-create/studio/brand";
const app = express(); app.use(express.json());
const { requireAuth } = await import("@/server/src/middleware/requireAuth");
app.use("/api/oyama-create", requireAuth, trash, campaigns, assets, brandRoutes);
const org = "synthetic-trash-org";
const call = (method: "get" | "post" | "put", path: string, body?: unknown, role = "admin", organizationId = org) => {
  const action = request(app)[method](`/api/oyama-create${path}`).set("Authorization", `Bearer ${signAccessToken({ sub: "synthetic-staff", orgId: organizationId, email: "staff@example.invalid", role })}`);
  return body === undefined ? action : action.send(body as object);
};
const preview = async (kind: string, id: string) => (await call("get", `/trash/preview?kind=${kind}&id=${id}`)).body;
const remove = async (kind: string, id: string) => call("post", "/trash", { kind, resourceId: id, reviewToken: (await preview(kind, id)).reviewToken, confirm: true });
beforeEach(async () => {
  resetCreateRows();
  await db.organization.create({ data: { id: org, name: "Synthetic trash acceptance" } });
  await db.organizationSettings.create({ data: { organizationId: org } });
});
async function campaign() { return db.createCampaign.create({ data: { id: "appeal", organizationId: org, name: "Synthetic appeal", ownerId: "synthetic-staff", channelsJson: ["EMAIL"], audienceListIds: [] } }); }
describe("recoverable Create Trash", () => {
  it("hides and restores a campaign under the original ID while preserving release history", async () => {
    await campaign();
    await db.createRelease.create({ data: { id: "release", organizationId: org, campaignId: "appeal", campaignRevision: 1, status: "RELEASED" } });
    await db.createDelivery.create({ data: { organizationId: org, releaseId: "release", status: "ACCEPTED" } });
    const removed = await remove("CAMPAIGN", "appeal"); expect(removed.status).toBe(201);
    expect((await call("get", "/campaigns?templates=false")).body.items).toEqual([]);
    const direct = await call("get", "/campaigns/appeal"); expect(direct.body.trashed).toBe(true); expect(direct.body.status).toBe("HISTORICAL");
    expect(rows.createDelivery[0].status).toBe("ACCEPTED"); expect(rows.createRelease[0].status).toBe("RELEASED");
    expect((await call("post", `/trash/${removed.body.id}/restore`, { confirm: true, revision: 0 })).status).toBe(409);
    expect((await call("post", `/trash/${removed.body.id}/restore`, { confirm: true, revision: 1 })).status).toBe(200);
    expect((await call("get", "/campaigns?templates=false")).body.items[0].id).toBe("appeal");
    expect(rows.createCampaign[0].revision).toBe(3);
    expect(rows.createDelivery[0].status).toBe("ACCEPTED");
    expect(rows.auditLog.map(row => row.action)).toEqual(["CREATE_ITEM_TRASHED", "CREATE_ITEM_RESTORED"]);
  });
  it("blocks pending deliveries, stale reviews, cross-tenant reads and unauthorized removals", async () => {
    await campaign();
    await db.createRelease.create({ data: { id: "release", organizationId: org, campaignId: "appeal", campaignRevision: 1 } });
    const job = await db.createDelivery.create({ data: { organizationId: org, releaseId: "release", status: "UNKNOWN" } });
    expect((await remove("CAMPAIGN", "appeal")).status).toBe(409);
    await db.createDelivery.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    const checked = await preview("CAMPAIGN", "appeal");
    await db.createCampaign.update({ where: { id: "appeal" }, data: { revision: { increment: 1 } } });
    expect((await call("post", "/trash", { kind: "CAMPAIGN", resourceId: "appeal", reviewToken: checked.reviewToken, confirm: true })).status).toBe(409);
    expect((await call("get", "/trash/preview?kind=CAMPAIGN&id=appeal", undefined, "admin", "other-org")).status).toBe(404);
    expect((await call("get", "/trash/preview?kind=CAMPAIGN&id=appeal", undefined, "volunteer")).status).toBe(403);
    expect(rows.createTrashItem).toEqual([]);
  });
  it("prevents edits and later release operations while a campaign is in Trash", async () => {
    await campaign(); await remove("CAMPAIGN", "appeal");
    const req = { user: { sub: "synthetic-staff", orgId: org, role: "admin" } } as Parameters<typeof assertCampaign>[0];
    await expect(assertCampaign(req, "appeal", true)).rejects.toThrow(/Restore/);
    await expect(db.$transaction((tx: Parameters<typeof touchCampaign>[0]) => touchCampaign(tx, org, "appeal", 2))).rejects.toThrow(/Restore/);
    expect(rows.createCampaign[0].revision).toBe(2);
  });
  it("retains image records and existing selections while hiding trashed uploads from new pickers", async () => {
    const source = `/uploads/letter-media/${org}/story.png`;
    await db.createStudioAsset.create({ data: { id: "image", organizationId: org, name: "Story", kind: "IMAGE", url: source, checksum: "fixture-checksum" } });
    expect((await remove("ASSET", "image")).status).toBe(201);
    expect((await call("get", "/studio/assets")).body).toEqual([]);
    expect(rows.createStudioAsset[0].url).toBe(source);
    const previous = { type: "image", attrs: { studioId: "existing", src: source } };
    await expect(assertAvailableSelections(org, previous, previous)).resolves.toBeUndefined();
    await expect(assertAvailableSelections(org, { ...previous, attrs: { ...previous.attrs, studioId: "new" } }, previous)).rejects.toThrow(/Restore/);
    expect((await call("get", "/trash")).body.items[0].resourceId).toBe("image");
  });
  it("requires replacement of defaults and keeps trashed signers recoverable through brand draft restoration", async () => {
    const document = normalizeBrand({ version: 1, identity: {}, signers: [{ id: "signer", name: "Director", active: true }], presets: [{ id: "header", name: "Letterhead", kind: "header", active: true, isDefault: true }], defaultSignerId: "signer" });
    await db.createBrandDraft.create({ data: { organizationId: org, documentJson: document, updatedBy: "synthetic-staff" } });
    expect((await remove("SIGNATURE", "signer")).status).toBe(409);
    expect((await remove("PRESET", "header")).status).toBe(409);
    document.defaultSignerId = null; document.presets[0].isDefault = false;
    await db.createBrandDraft.update({ where: { organizationId: org }, data: { documentJson: document, revision: { increment: 1 } } });
    expect((await remove("SIGNATURE", "signer")).status).toBe(201);
    expect((await remove("PRESET", "header")).status).toBe(201);
    const state = (await call("get", "/brand")).body;
    expect(state.document.signers[0].trashed).toBe(true);
    const changed = { ...state.document, signers: [], presets: [] };
    expect((await call("put", "/brand/draft", { revision: state.draftRevision, document: changed })).status).toBe(200);
    const refreshed = (await call("get", "/brand")).body;
    expect(refreshed.document.signers[0].id).toBe("signer"); expect(refreshed.document.presets[0].id).toBe("header");
    refreshed.document.defaultSignerId = "signer";
    expect((await call("put", "/brand/draft", { revision: refreshed.draftRevision, document: refreshed.document })).status).toBe(409);
  });
  it("allows only owners or administrators to remove saved sections", async () => {
    await db.createStudioSection.create({ data: { id: "section", organizationId: org, ownerId: "another-staff", name: "Private section", shared: true, documentJson: {} } });
    expect((await call("get", "/trash/preview?kind=SECTION&id=section", undefined, "staff")).status).toBe(403);
    expect((await remove("SECTION", "section")).status).toBe(201);
    expect((await call("get", "/studio/sections")).body).toEqual([]);
  });
});
