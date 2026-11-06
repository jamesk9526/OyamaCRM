import "dotenv/config";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import workspace from "@/server/src/oyama-create/workspace";
import classicLetter from "@/server/src/oyama-create/classic-routes";
import letterAdaptations from "@/server/src/oyama-create/letter-adaptation-routes";
import studio from "@/server/src/oyama-create/studio/routes";
import { requireAuth } from "@/server/src/middleware/requireAuth";
import { signAccessToken } from "@/server/src/lib/auth";
const app = express(); app.use(express.json(), requireAuth, workspace, classicLetter, letterAdaptations, studio);
const call = (method: "get" | "put" | "post" | "patch", path: string, body?: object, orgId = "v5-org", role = "admin") => {
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
    expect((await call("get", "/workspace/config")).body).toEqual({ shellEnabled: false, unifiedEditorEnabled: false, classicLettersEnabled: false });
    expect((await call("put", "/workspace/config", { shellEnabled: true, unifiedEditorEnabled: true, classicLettersEnabled: true, confirm: true })).status).toBe(200);
    expect(rows.organizationSettings[0]).toMatchObject({ oyamaCreateV5ShellEnabled: true, oyamaCreateUnifiedEditorEnabled: true, oyamaCreateClassicLettersEnabled: true });
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

describe("Create-owned classic Letters", () => {
  const endpoint = "/contents/v5-content/letter";
  beforeEach(async () => {
    await db.organization.create({ data: { id: "v5-org", name: "Synthetic organization" } });
    await db.organizationSettings.create({ data: { organizationId: "v5-org", oyamaCreateClassicLettersEnabled: true } });
    await db.letterTemplate.create({ data: { id: "legacy-letter", organizationId: "v5-org", crmScope: "DONOR", name: "Original November Letter", printBody: "<p>Dear {first},</p><p>Original appeal copy.</p>" } });
    await db.createVariant.create({ data: { organizationId: "v5-org", contentId: "v5-content", channel: "LETTER", legacyId: "legacy-letter", documentJson: {} } });
  });
  it("opens a named original, saves only a scoped working copy, and keeps the compatible reader after rollout is disabled", async () => {
    const opened = await call("get", endpoint);
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    expect(opened.body.template).toMatchObject({ name: "Original November Letter", printBody: expect.stringContaining("{first}") });
    expect(opened.body.saved).toBe(false);
    expect(rows.letterTemplate).toHaveLength(1);
    const edit = { ...opened.body, template: { ...opened.body.template, printBody: "<p>Dear {first},</p><p>Create draft edits.</p>" } };
    const saved = await call("put", endpoint, edit);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(rows.letterTemplate.find(row => row.id === "legacy-letter")?.printBody).toContain("Original appeal copy.");
    expect(rows.letterTemplate.find(row => row.createContentId === "v5-content")?.printBody).toContain("Create draft edits.");
    expect(rows.createDocumentRevision.at(-1)?.documentJson.classicLetter.template.printBody).toContain("Create draft edits.");
    expect((await call("put", endpoint, edit)).status).toBe(409);
    expect((await call("get", endpoint, undefined, "foreign")).status).toBe(404);
    expect((await call("patch", "/contents/v5-content/studio", { design: {}, channel: "LETTER" })).status).toBe(409);
    rows.organizationSettings[0].oyamaCreateClassicLettersEnabled = false;
    expect((await call("get", endpoint)).body.saved).toBe(true);
  });
  it("keeps a conversion draft outside delivery, rejects a stale proposal, and requires permission for a sensitive recipient proof", async () => {
    const opened = (await call("get", endpoint)).body;
    const first = await call("put", endpoint, { ...opened, template: { ...opened.template, printBody: "<p>Dear {first},</p><p>Public story.</p><p>{{donation.amount}}</p>" } });
    expect(first.status).toBe(200);
    const channel = endpoint + "/adaptations/WEB";
    const proposed = await call("post", channel, { action: "preview" });
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
    expect(proposed.body.changes.map((change: { after: string }) => change.after)).toEqual(["Public story."]);
    expect((await call("post", channel, { action: "apply", review: "stale", selected: [0] })).status).toBe(409);
    const applied = await call("post", channel, { action: "apply", review: proposed.body.review, selected: [0] });
    expect(applied.status, JSON.stringify(applied.body)).toBe(200);
    expect(rows.createVariant.find(row => row.channel === "WEB")?.documentJson.enabled).toBe(false);
    expect(rows.createDelivery).toHaveLength(0);
    await db.userPermission.create({ data: { userId: "v5-staff", permission: "letters.view_sensitive_merge_data", granted: false } });
    expect((await call("post", endpoint + "/proof", { revision: applied.body.revision, letterRevision: 1, constituentId: "fixture-recipient" })).status).toBe(403);
  });
});
