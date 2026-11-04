/** Actual care handlers with encrypted synthetic messages. No real clinical data. */
import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { careRows, resetCareRows } from "../helpers/compassion-memory-database";

vi.mock("@/server/src/compassion/database", async () => {
  const { careMemoryDatabase } = await import("../helpers/compassion-memory-database");
  const database = new Proxy(careMemoryDatabase, { get(target, property) {
    if (property === "compassionPointEntry") return { aggregate: async () => ({ _sum: { amount: 0 } }) };
    return Reflect.get(target, property);
  } });
  return { prisma: database, compassionDatabase: database, atomic: async (_org: string, work: () => Promise<unknown>) => work() };
});
import app from "@/server/src/compassion/app";
import { signAccessToken } from "@/server/src/lib/auth";
import { digest, seal } from "@/server/src/compassion/security";

const org = "synthetic-history-org";
beforeEach(() => {
  resetCareRows(); process.env.COMPASSION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  careRows.user = [{ id: "staff", organizationId: org, active: true }];
  careRows.compassionMembership = [{ organizationId: org, userId: "staff", role: "CASEWORKER", active: true }];
  careRows.compassionClient = [{ id: "client", organizationId: org }];
  careRows.compassionPortalAccess = [{ organizationId: org, clientId: "client", tokenHash: digest("synthetic-access"), expiresAt: new Date(Date.now() + 60000), revokedAt: null }];
  careRows.compassionMessage = Array.from({ length: 260 }, (_, index) => ({
    id: `message-${String(index).padStart(3, "0")}`, organizationId: org, clientId: "client", direction: index % 2 ? "STAFF" : "CLIENT",
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)), encryptedContent: seal(`Message ${index}`, `${org}:client:message`),
  }));
  careRows.compassionMessage.push({ id: "foreign", organizationId: "foreign", clientId: "client", createdAt: new Date(), encryptedContent: "must-never-decrypt" });
});

function assertRecent(messages: Array<{ id: string; content: string }>) {
  expect(messages).toHaveLength(250);
  expect(messages[0]).toMatchObject({ id: "message-010", content: "Message 10" });
  expect(messages.at(-1)).toMatchObject({ id: "message-259", content: "Message 259" });
  expect(messages.some(message => message.id === "foreign")).toBe(false);
}
describe("care conversation recent history", () => {
  it("shows the latest messages chronologically in the care-team view", async () => {
    const token = signAccessToken({ sub: "staff", orgId: org, role: "staff", email: "synthetic@example.invalid" });
    const response = await request(app).get("/api/compassion/messages?clientId=client").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200); assertRecent(response.body);
  });
  it("shows the same recent conversation in the client portal without exposing other clients", async () => {
    const response = await request(app).get("/api/compassion-public/portal/synthetic-access");
    expect(response.status).toBe(200); assertRecent(response.body.messages);
  });
});
