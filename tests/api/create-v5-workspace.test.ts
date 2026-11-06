import "dotenv/config";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import workspace from "@/server/src/oyama-create/workspace";
import { requireAuth } from "@/server/src/middleware/requireAuth";
import { signAccessToken } from "@/server/src/lib/auth";
const app = express(); app.use(express.json(), requireAuth, workspace);
const call = (method: "get" | "put" | "post", path: string, body?: object, orgId = "v5-org", role = "admin") => {
  const action = request(app)[method](path).set("Authorization", `Bearer ${signAccessToken({ sub: "v5-staff", orgId, role, email: "synthetic@example.invalid" })}`);
  return body ? action.send(body) : action;
};
beforeEach(async () => {
  resetCreateRows(); await db.createCampaign.create({ data: { id: "v5-campaign", organizationId: "v5-org", ownerId: "v5-staff", name: "Synthetic", channelsJson: ["LETTER"], audienceListIds: [] } });
  await db.createContent.create({ data: { id: "v5-content", campaignId: "v5-campaign", organizationId: "v5-org", name: "Synthetic letter", documentJson: {} } });
});
describe("v5 internal notes and rollout", () => {
  it("saves internal notes without modifying content, campaign, releases or deliveries", async () => {
    const before = structuredClone([rows.createContent, rows.createCampaign]);
    expect((await call("get", "/contents/v5-content/notes")).body).toMatchObject({ text: "", revision: 0 });
    expect((await call("put", "/contents/v5-content/notes", { text: "Internal only", revision: 0 })).status).toBe(200);
    expect((await call("get", "/contents/v5-content/notes")).body).toMatchObject({ text: "Internal only", revision: 1 });
    expect([rows.createContent, rows.createCampaign]).toEqual(before); expect(rows.createRelease).toHaveLength(0); expect(rows.createDelivery).toHaveLength(0);
  });
  it("rejects stale writes and cross-organization access", async () => {
    await call("put", "/contents/v5-content/notes", { text: "First", revision: 0 });
    expect((await call("put", "/contents/v5-content/notes", { text: "Stale", revision: 0 })).status).toBe(409);
    expect((await call("put", "/contents/v5-content/notes", { text: "Second", revision: 1 })).status).toBe(200);
    expect((await call("put", "/contents/v5-content/notes", { text: "Stale", revision: 1 })).status).toBe(409);
    expect((await call("get", "/contents/v5-content/notes", undefined, "foreign")).status).toBe(404);
  });
  it("enforces edit permission, historical protection and size validation", async () => {
    expect((await call("put", "/contents/v5-content/notes", { text: "x".repeat(20001), revision: 0 })).status).toBe(400);
    await db.userPermission.create({ data: { userId: "v5-staff", permission: "letters.edit", granted: false } });
    expect((await call("put", "/contents/v5-content/notes", { text: "Denied", revision: 0 })).status).toBe(403);
    rows.userPermission = []; rows.createCampaign[0].status = "HISTORICAL";
    expect((await call("put", "/contents/v5-content/notes", { text: "Historical", revision: 0 })).status).toBe(409);
  });
  it("keeps rollout off by default and independent of live delivery", async () => {
    expect((await call("get", "/workspace/config")).body).toEqual({ shellEnabled: false, unifiedEditorEnabled: false });
    expect((await call("put", "/workspace/config", { shellEnabled: true, unifiedEditorEnabled: true, confirm: true })).status).toBe(200);
    expect(rows.organizationSettings[0]).toMatchObject({ oyamaCreateV5ShellEnabled: true, oyamaCreateUnifiedEditorEnabled: true });
    expect(rows.organizationSettings[0].oyamaCreateEnabled).not.toBe(true);
    expect((await call("put", "/workspace/config", { shellEnabled: false, unifiedEditorEnabled: false, confirm: true }, "v5-org", "compassion_user")).status).toBe(403);
  });
  it("starts a complete, pinned unified draft without an audience, release or delivery", async () => {
    await db.organization.create({ data: { id: "v5-org", name: "Synthetic organization" } });
    await db.organizationSettings.create({ data: { organizationId: "v5-org", oyamaCreateUnifiedEditorEnabled: true } });
    const original = await db.letterTemplate.create({ data: { organizationId: "v5-org", name: "Original", printBody: "Keep unchanged" } });
    const result = await call("post", "/workspace/start", { kind: "LETTER", name: "New named letter" });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const content = rows.createContent.find(item => item.id === result.body.contentId)!;
    expect(content.designJson.version).toBe(4); expect(content.designJson.brandRevisionId).toBeTruthy();
    expect(rows.createCampaign.find(item => item.id === result.body.campaignId)?.audienceListIds).toEqual([]);
    expect(rows.letterTemplate.find(item => item.id === original.id)).toEqual(original);
    expect(rows.createDelivery).toHaveLength(0); expect(rows.createRelease).toHaveLength(0);
  });
});
