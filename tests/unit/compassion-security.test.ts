import { describe, expect, it } from "vitest";
import { hasCareCapability, seal, unseal } from "@/server/src/compassion/security";
import { validateImportRow } from "@/server/src/compassion/migration";
import { mayEditChart } from "@/server/src/compassion/clinical";
import { validAvailability, withinAvailability } from "@/server/src/compassion/scheduling";
import express from "express";
import request from "supertest";
import { signAccessToken } from "@/server/src/lib/auth";
import { requireAuth } from "@/server/src/middleware/requireAuth";
describe("Compassion security and migration rules", () => {
  it("does not treat donor/platform roles as care capabilities", () => {
    for (const role of ["admin", "manager", "staff", "readonly", "report_viewer", "unknown"]) expect(hasCareCapability(role, "clinical")).toBe(false);
    expect(hasCareCapability("ADMIN", "sign")).toBe(false); expect(hasCareCapability("PHYSICIAN", "sign")).toBe(true); expect(hasCareCapability("RECEPTION", "clinical")).toBe(false);
  });
  it("restricts care-only identities without changing existing donor role authentication", async () => {
    const app = express(); app.get(["/api/donations", "/api/auth/me", "/api/compassion/access"], requireAuth, (_req, res) => res.json({ ok: true }));
    const care = signAccessToken({ sub: "care-only", email: "care@example.invalid", role: "compassion_user", orgId: "test" });
    const donor = signAccessToken({ sub: "donor", email: "donor@example.invalid", role: "staff", orgId: "test" });
    expect((await request(app).get("/api/donations").set("Authorization", `Bearer ${care}`)).status).toBe(403);
    expect((await request(app).get("/api/compassion/access").set("Authorization", `Bearer ${care}`)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${care}`)).status).toBe(200);
    expect((await request(app).get("/api/donations").set("Authorization", `Bearer ${donor}`)).status).toBe(200);
  });
  it("binds encrypted content to its organization, client, and purpose", () => {
    process.env.COMPASSION_ENCRYPTION_KEY ||= "ab".repeat(32);
    const encrypted = seal("private data", "org:client:chart");
    expect(unseal(encrypted, "org:client:chart")).toBe("private data");
    expect(() => unseal(encrypted, "other:client:chart")).toThrow(); expect(seal("private data", "org:client:chart")).not.toBe(encrypted);
  });
  it("protects submitted and signed charts", () => {
    expect(mayEditChart("DRAFT", "a", "a")).toBe(true); expect(mayEditChart("DRAFT", "a", "b")).toBe(false);
    expect(mayEditChart("REVIEW", "a", "a")).toBe(false); expect(mayEditChart("SIGNED", "a", "a")).toBe(false);
  });
  it("rejects malformed rows and unsupported clinical columns", () => {
    expect(validateImportRow({ externalSourceId: "1", firstName: "Test", lastName: "Client" })).toEqual([]);
    expect(validateImportRow({ externalSourceId: "1", firstName: "Test", lastName: "Client", ultrasoundResult: "unknown" }).join(" ")).toContain("Unsupported fields");
    expect(validateImportRow({ firstName: "Test" }).length).toBeGreaterThan(0);
  });
  it("checks resource availability in its timezone across daylight-saving changes", () => {
    const windows = [{ day: 1, start: "09:00", end: "17:00" }];
    expect(validAvailability(windows)).toBe(true); expect(validAvailability([{ day: 1, start: "17:00", end: "09:00" }])).toBe(false);
    expect(withinAvailability(new Date("2027-03-15T14:00:00Z"), new Date("2027-03-15T15:00:00Z"), "America/Chicago", windows)).toBe(true);
    expect(withinAvailability(new Date("2027-03-15T13:00:00Z"), new Date("2027-03-15T14:00:00Z"), "America/Chicago", windows)).toBe(false);
    expect(withinAvailability(new Date("2027-03-14T14:00:00Z"), new Date("2027-03-14T15:00:00Z"), "America/Chicago", windows)).toBe(false);
  });
});
