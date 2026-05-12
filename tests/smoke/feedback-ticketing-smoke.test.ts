/** Smoke tests for cross-CRM feedback submission and Watchdog ticket triage APIs. */

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
let staffToken = "";
let ticketId = "";
let ticketNumber = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  adminToken = adminLogin.body.data?.accessToken ?? "";

  const email = `feedback.staff.${Date.now()}@hopefoundation.org`;
  const password = "staff12345!";

  const createdUser = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email,
      firstName: "Feedback",
      lastName: "Staff",
      role: "staff",
      password,
    });

  expect(createdUser.status).toBe(201);

  const staffLogin = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  staffToken = staffLogin.body.data?.accessToken ?? "";
});

describe("feedback ticketing flow", () => {
  it("allows staff users to submit feedback tickets", async () => {
    const submit = await request(app)
      .post("/api/feedback/submit")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        type: "bug_report",
        priority: "high",
        whatTryingToDo: "Submit donation entry in DonorCRM.",
        whatHappened: "Save button stayed disabled after selecting a designation.",
        expectedResult: "Save button should enable once required fields are complete.",
        context: {
          crmScope: "donor",
          pageUrl: "https://localhost:3650/donations/new",
          routePath: "/donations/new",
          pageTitle: "Add Donation",
          browserInfo: "SmokeTestBrowser/1.0",
          deviceInfo: "Windows test runner",
          appVersion: "smoke-test",
          environment: "test",
        },
      });

    expect(submit.status).toBe(201);
    expect(submit.body.ticket).toHaveProperty("id");
    expect(submit.body.ticket).toHaveProperty("ticketNumber");

    ticketId = submit.body.ticket.id as string;
    ticketNumber = submit.body.ticket.ticketNumber as string;
  });

  it("blocks non-admin users from the Watchdog management queue", async () => {
    const listAsStaff = await request(app)
      .get("/api/watchdog/feedback-tickets")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(listAsStaff.status).toBe(403);
  });

  it("allows admin triage actions on submitted feedback tickets", async () => {
    const list = await request(app)
      .get(`/api/watchdog/feedback-tickets?search=${encodeURIComponent(ticketNumber)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((item: { id: string }) => item.id === ticketId)).toBe(true);

    const update = await request(app)
      .patch(`/api/watchdog/feedback-tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "in_review",
        priority: "high",
        developerNotes: "Investigating reproduction path from smoke test.",
      });

    expect(update.status).toBe(200);
    expect(update.body.item.status).toBe("in_review");

    const resolve = await request(app)
      .post(`/api/watchdog/feedback-tickets/${ticketId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolutionNotes: "Root cause identified and fixed in queue." });

    expect(resolve.status).toBe(200);
    expect(resolve.body.item.status).toBe("resolved");

    const reopen = await request(app)
      .post(`/api/watchdog/feedback-tickets/${ticketId}/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(reopen.status).toBe(200);
    expect(reopen.body.item.status).toBe("in_review");
  });
});
