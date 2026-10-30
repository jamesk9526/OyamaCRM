import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ constituent: { findMany: vi.fn() }, generatedLetter: { findMany: vi.fn() }, pluginSetting: { findUnique: vi.fn() } }));
const services = vi.hoisted(() => ({ render: vi.fn(), template: vi.fn(), merge: vi.fn(), validate: vi.fn(), generate: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org" }));
vi.mock("@/server/src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/src/services/avery-labels", () => ({ renderAvery5160Pdf: services.render }));
vi.mock("@/server/src/services/letters-execution", () => ({ getTemplateForGeneration: services.template, resolveLetterMergeContext: services.merge, validateGenerationPlan: services.validate, generateLetterFromTemplate: services.generate }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => {
  req.user = { sub: "staff", email: "qa@example.invalid", role: "staff", orgId: "org" }; next();
} }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (req: Request, res: Response, next: NextFunction) => req.get("x-denied") ? res.sendStatus(403) : next() }));
import router from "@/server/src/routes/letters";
const app = express(); app.use(express.json()); app.use("/api/letters", router);
const people = ["A", "B", "C"].map((id) => ({ id, firstName: id, lastName: "Donor", addressLine1: `${id} Main Street`, city: "Austin", state: "TX", zip: "78701", doNotMail: false, doNotContact: false }));
beforeEach(() => {
  vi.clearAllMocks();
  db.constituent.findMany.mockResolvedValue(people);
  db.generatedLetter.findMany.mockResolvedValue([{ id: "l-a", constituentId: "A" }, { id: "l-b", constituentId: "B" }, { id: "l-c", constituentId: "C" }]);
  services.render.mockResolvedValue(Buffer.from("%PDF synthetic"));
  db.pluginSetting.findUnique.mockResolvedValue(null);
  services.template.mockResolvedValue({ id: "template", name: "Welcome", status: "ACTIVE", printBody: "Hello", printLayoutJson: null });
  services.merge.mockResolvedValue({ mergedPrintBody: "Hello", missingFields: [], unsupportedFields: [] });
  services.validate.mockReturnValue({ valid: true, reasons: [] });
  services.generate.mockImplementation(async ({ constituentId }) => ({ generated: { id: `l-${constituentId.toLowerCase()}`, metadataJson: null } }));
});

describe("matched mailing labels", () => {
  it("resolves the PDF letter order despite shuffled database results", async () => {
    const response = await request(app).post("/api/letters/labels/avery-5160.pdf").send({ letterIds: ["l-c", "l-a", "l-b"], startPosition: 4, showGuides: true });
    expect(response.status).toBe(200); expect(response.headers["x-labels-rendered"]).toBe("3");
    expect(services.render.mock.calls[0][0].map((row: { name: string }) => row.name)).toEqual(["C Donor", "A Donor", "B Donor"]);
    expect(services.render.mock.calls[0][1]).toEqual({ startPosition: 4, showGuides: true });
    expect(db.generatedLetter.findMany.mock.lastCall?.[0].where.organizationId).toBe("org");
    expect(db.constituent.findMany.mock.lastCall?.[0].where.organizationId).toBe("org");
  });
  it("keeps one label per distinct letter even when a recipient has two letters", async () => {
    db.generatedLetter.findMany.mockResolvedValue([{ id: "one", constituentId: "A" }, { id: "two", constituentId: "A" }]);
    const response = await request(app).post("/api/letters/labels/avery-5160.pdf").send({ letterIds: ["one", "two", "one"] });
    expect(response.status).toBe(200); expect(services.render.mock.calls[0][0]).toHaveLength(2);
  });
  it.each(["suppressed", "missing-address", "missing-person", "missing-letter"])("rejects %s without silently shifting the sheet", async (reason) => {
    if (reason === "suppressed") db.constituent.findMany.mockResolvedValue(people.map((person) => ({ ...person, doNotContact: person.id === "B" })));
    if (reason === "missing-address") db.constituent.findMany.mockResolvedValue(people.map((person) => ({ ...person, addressLine1: person.id === "B" ? "" : person.addressLine1 })));
    if (reason === "missing-person") db.constituent.findMany.mockResolvedValue(people.filter((person) => person.id !== "B"));
    if (reason === "missing-letter") db.generatedLetter.findMany.mockResolvedValue([]);
    const response = await request(app).post("/api/letters/labels/avery-5160.pdf").send({ letterIds: ["l-b", "l-a"], ignoreSuppressions: true });
    expect(response.status).toBe(409); expect(services.render).not.toHaveBeenCalled();
  });
  it("supports a strict preview recipient order and rejects ambiguous sources", async () => {
    const response = await request(app).post("/api/letters/labels/avery-5160.pdf").send({ constituentIds: ["C", "A"], requireAllRecipients: true });
    expect(response.status).toBe(200);
    expect(services.render.mock.calls[0][0].map((row: { name: string }) => row.name)).toEqual(["C Donor", "A Donor"]);
    const ambiguous = await request(app).post("/api/letters/labels/avery-5160.pdf").send({ constituentIds: ["A"], letterIds: ["l-a"] });
    expect(ambiguous.status).toBe(400);
  });
  it("preserves server permissions", async () => {
    const response = await request(app).post("/api/letters/labels/avery-5160.pdf").set("x-denied", "true").send({ letterIds: ["l-a"] });
    expect(response.status).toBe(403); expect(db.generatedLetter.findMany).not.toHaveBeenCalled();
  });
  it("rejects a partial production PDF when any requested letter is missing", async () => {
    db.generatedLetter.findMany.mockResolvedValue([{ id: "l-a" }]);
    const response = await request(app).post("/api/letters/generated/export-pdf-batch").send({ letterIds: ["l-a", "missing"] });
    expect(response.status).toBe(404);
  });
  it("generates in selected order, deduplicates and reports unavailable recipients", async () => {
    const response = await request(app).post("/api/letters/generated/batch").send({ templateId: "template", constituentIds: ["C", "missing", "A", "C", "B"], donationMode: "none" });
    expect(response.status).toBe(200);
    expect(services.generate.mock.calls.map(([arg]) => arg.constituentId)).toEqual(["C", "A", "B"]);
    expect(response.body.generatedIds).toEqual(["l-c", "l-a", "l-b"]);
    expect(response.body).toMatchObject({ totalSelected: 4, eligible: 3, skippedCount: 1 });
  });
});

