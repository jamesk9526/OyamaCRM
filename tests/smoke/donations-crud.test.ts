/**
 * Donation CRUD smoke tests.
 * Covers the full lifecycle: list, create, get by ID, update, delete,
 * filter by constituent/date/status, and donation-import dry-run.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let donationId = "";
let loopResult: {
  donationId: string;
  constituentId: string;
  emailDraft?: { status: string; id?: string };
  followUpTask?: { status: string; id?: string };
  pathEnrollment?: { status: string; id?: string };
  redirectTo?: string;
} | null = null;
const testConstituentId = "con_01"; // seeded constituent

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
});

describe("donation CRUD", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("lists donations with pagination shape", async () => {
    const res = await request(app).get("/api/donations").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(typeof res.body.page).toBe("number");
    expect(typeof res.body.limit).toBe("number");
  });

  it("creates a new donation and returns 201", async () => {
    const res = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: testConstituentId,
        amount: 250,
        date: new Date().toISOString(),
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
        notes: "Smoke test donation",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(Number(res.body.amount)).toBe(250);
    expect(res.body.paymentMethod).toBe("CHECK");
    donationId = res.body.id;
  });

  it("runs the complete stewardship loop quick action", async () => {
    expect(donationId).toBeTruthy();

    const res = await request(app)
      .post(`/api/donations/${donationId}/quick-actions/stewardship-loop`)
      .set(auth())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.donationId).toBe(donationId);
    expect(res.body.constituentId).toBe(testConstituentId);

    expect(["CREATED", "REUSED", "SKIPPED"]).toContain(res.body.emailDraft?.status);
    expect(["CREATED", "REUSED", "SKIPPED"]).toContain(res.body.followUpTask?.status);
    expect(["CREATED", "REUSED", "SKIPPED"]).toContain(res.body.pathEnrollment?.status);
    expect(typeof res.body.redirectTo).toBe("string");

    loopResult = res.body;
  });

  it("surfaces loop artifacts across tasks, communications, paths, and timeline", async () => {
    expect(loopResult).toBeTruthy();

    if (loopResult?.emailDraft?.id) {
      const campaignRes = await request(app)
        .get(`/api/email-campaigns/${loopResult.emailDraft.id}`)
        .set(auth());
      expect(campaignRes.status).toBe(200);
      expect(campaignRes.body.id).toBe(loopResult.emailDraft.id);
    }

    if (loopResult?.followUpTask?.id) {
      const tasksRes = await request(app)
        .get(`/api/tasks?scope=all&constituentId=${encodeURIComponent(testConstituentId)}&limit=100`)
        .set(auth());
      expect(tasksRes.status).toBe(200);
      const taskIds = (tasksRes.body.items as Array<{ id: string }>).map((task) => task.id);
      expect(taskIds).toContain(loopResult.followUpTask.id);
    }

    if (loopResult?.pathEnrollment?.id) {
      const enrollmentsRes = await request(app)
        .get(`/api/steward-paths/enrollments?constituentId=${encodeURIComponent(testConstituentId)}&limit=100`)
        .set(auth());
      expect(enrollmentsRes.status).toBe(200);
      const enrollmentIds = (enrollmentsRes.body as Array<{ id: string }>).map((enrollment) => enrollment.id);
      expect(enrollmentIds).toContain(loopResult.pathEnrollment.id);
    }

    const constituentRes = await request(app)
      .get(`/api/constituents/${testConstituentId}`)
      .set(auth());
    expect(constituentRes.status).toBe(200);
    const loopNoteFound = (constituentRes.body.activities as Array<{ donationId?: string | null; description?: string | null }>)
      .some((activity) => activity.donationId === donationId
        && typeof activity.description === "string"
        && activity.description.includes("Donation stewardship loop executed"));
    expect(loopNoteFound).toBe(true);
  });

  it("fetches the donation by ID", async () => {
    expect(donationId).toBeTruthy();
    const res = await request(app).get(`/api/donations/${donationId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(donationId);
    expect(Number(res.body.amount)).toBe(250);
    expect(res.body.constituent).toBeDefined();
  });

  it("returns 404 for unknown donation ID", async () => {
    const res = await request(app).get("/api/donations/nonexistent-id-xyz").set(auth());
    expect(res.status).toBe(404);
  });

  it("updates donation amount and status", async () => {
    expect(donationId).toBeTruthy();
    const res = await request(app)
      .put(`/api/donations/${donationId}`)
      .set(auth())
      .send({ amount: 275, status: "COMPLETED", notes: "Updated by smoke test" });
    expect(res.status).toBe(200);
    expect(Number(res.body.amount)).toBe(275);
  });

  it("filters donations by constituentId", async () => {
    const res = await request(app)
      .get(`/api/donations?constituentId=${testConstituentId}&limit=100`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // All returned donations should belong to the test constituent
    for (const d of res.body.items as Array<{ constituent: { id: string } }>) {
      expect(d.constituent?.id).toBe(testConstituentId);
    }
  });

  it("filters donations by status", async () => {
    const res = await request(app).get("/api/donations?status=COMPLETED").set(auth());
    expect(res.status).toBe(200);
    for (const d of res.body.items as Array<{ status: string }>) {
      expect(d.status).toBe("COMPLETED");
    }
  });

  it("filters donations by date range", async () => {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/donations?from=${from}&to=${to}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("donation import dry-run returns expected shape", async () => {
    const res = await request(app)
      .post("/api/donations/import")
      .set(auth())
      .send({
        records: [
          {
            donorEmail: "admin@hopefoundation.org",
            amount: "100",
            date: new Date().toISOString(),
            paymentMethod: "ONLINE",
          },
        ],
        dryRun: true,
        matchEmail: true,
        skipUnmatched: false,
        dedupByReceipt: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(typeof res.body.created).toBe("number");
    expect(typeof res.body.skipped).toBe("number");
    expect(typeof res.body.unmatched).toBe("number");
  });

  it("donation import rejects empty records array", async () => {
    const res = await request(app)
      .post("/api/donations/import")
      .set(auth())
      .send({ records: [], dryRun: true });
    expect(res.status).toBe(400);
  });

  it("deletes the smoke donation", async () => {
    expect(donationId).toBeTruthy();
    const res = await request(app).delete(`/api/donations/${donationId}`).set(auth());
    expect([200, 204]).toContain(res.status);
  });
});
