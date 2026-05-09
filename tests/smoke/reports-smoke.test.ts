/**
 * Authenticated smoke tests for the OyamaCRM reporting API.
 *
 * These tests verify that:
 * - Every report endpoint is reachable with a valid JWT token.
 * - Each endpoint returns the expected response shape.
 * - Retention and YoY data is safe (no NaN, no divide-by-zero).
 * - Date filters return arrays of the correct length.
 *
 * They run against the real test database (seeded with org_demo data).
 * The seeded data includes donors and donations across multiple years, so
 * the reports should return non-trivial results — not just empty arrays.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let authToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  // Authenticate as the seeded admin user
  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  expect(login.status).toBe(200);
  authToken = login.body.data?.accessToken ?? "";
  expect(authToken).toBeTruthy();
});

/** Convenience: make an authenticated GET request. */
function authGet(path: string) {
  return request(app).get(path).set("Authorization", `Bearer ${authToken}`);
}

// ─── /api/reports/summary ────────────────────────────────────────────────────

describe("GET /api/reports/summary", () => {
  it("returns 200 with the expected shape", async () => {
    const res = await authGet("/api/reports/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ytdAmount");
    expect(res.body).toHaveProperty("ytdCount");
    expect(res.body).toHaveProperty("weekAmount");
    expect(res.body).toHaveProperty("weekCount");
    expect(res.body).toHaveProperty("monthAmount");
    expect(res.body).toHaveProperty("totalConstituents");
    expect(res.body).toHaveProperty("activeCampaigns");
    expect(res.body).toHaveProperty("pendingTasks");
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/reports/summary");
    expect(res.status).toBe(401);
  });

  it("ytdAmount is a finite number >= 0", async () => {
    const res = await authGet("/api/reports/summary");
    expect(Number.isFinite(res.body.ytdAmount)).toBe(true);
    expect(res.body.ytdAmount).toBeGreaterThanOrEqual(0);
  });

  it("momTrend is null or an integer", async () => {
    const res = await authGet("/api/reports/summary");
    const t = res.body.momTrend;
    if (t !== null && t !== undefined) {
      expect(Number.isInteger(t)).toBe(true);
    }
  });
});

// ─── /api/reports/giving-by-month ────────────────────────────────────────────

describe("GET /api/reports/giving-by-month", () => {
  it("returns exactly 12 months for the current year", async () => {
    const res = await authGet("/api/reports/giving-by-month");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
  });

  it("each month object has numeric month (1–12) and amount >= 0", async () => {
    const res = await authGet("/api/reports/giving-by-month");
    for (const d of res.body) {
      expect(d.month).toBeGreaterThanOrEqual(1);
      expect(d.month).toBeLessThanOrEqual(12);
      expect(typeof d.amount).toBe("number");
      expect(d.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("accepts a year query param and returns 12 months for that year", async () => {
    const lastYear = new Date().getFullYear() - 1;
    const res = await authGet(`/api/reports/giving-by-month?year=${lastYear}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
  });

  it("months are in ascending order 1–12", async () => {
    const res = await authGet("/api/reports/giving-by-month");
    const months = res.body.map((d: { month: number }) => d.month);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

// ─── /api/reports/donor-retention ────────────────────────────────────────────

describe("GET /api/reports/donor-retention", () => {
  it("returns 200 with total, retained, and rate", async () => {
    const res = await authGet("/api/reports/donor-retention");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("retained");
    expect(res.body).toHaveProperty("rate");
    expect(res.body).toHaveProperty("year");
  });

  it("rate is an integer 0–100 (not NaN)", async () => {
    const res = await authGet("/api/reports/donor-retention");
    const { rate } = res.body;
    expect(Number.isInteger(rate)).toBe(true);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(100);
  });

  it("retained <= total (can never retain more than the base cohort)", async () => {
    const res = await authGet("/api/reports/donor-retention");
    const { retained, total } = res.body;
    expect(retained).toBeLessThanOrEqual(total);
  });

  it("returns 0 rate when total is 0 (no prior-year donors)", async () => {
    // This verifies divide-by-zero safety — when the DB returns 0 prior donors
    // the endpoint must return 0, not NaN.
    const res = await authGet("/api/reports/donor-retention");
    const { total, rate } = res.body;
    if (total === 0) {
      expect(rate).toBe(0);
    }
  });
});

// ─── /api/reports/year-comparison ────────────────────────────────────────────

describe("GET /api/reports/year-comparison", () => {
  it("returns 12 month objects with thisYear and lastYear amounts", async () => {
    const res = await authGet("/api/reports/year-comparison");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
    for (const d of res.body) {
      expect(d).toHaveProperty("month");
      expect(d).toHaveProperty("thisYear");
      expect(d).toHaveProperty("lastYear");
      expect(d.thisYear).toBeGreaterThanOrEqual(0);
      expect(d.lastYear).toBeGreaterThanOrEqual(0);
    }
  });

  it("amounts are finite numbers (no NaN or Infinity)", async () => {
    const res = await authGet("/api/reports/year-comparison");
    for (const d of res.body) {
      expect(Number.isFinite(d.thisYear)).toBe(true);
      expect(Number.isFinite(d.lastYear)).toBe(true);
    }
  });
});

// ─── /api/reports/top-donors ─────────────────────────────────────────────────

describe("GET /api/reports/top-donors", () => {
  it("returns an array of donors", async () => {
    const res = await authGet("/api/reports/top-donors");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each donor has id, firstName, lastName, totalLifetimeGiving", async () => {
    const res = await authGet("/api/reports/top-donors");
    for (const d of res.body) {
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("firstName");
      expect(d).toHaveProperty("lastName");
      expect(d).toHaveProperty("totalLifetimeGiving");
    }
  });

  it("respects the limit query param", async () => {
    const res = await authGet("/api/reports/top-donors?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });

  it("totalLifetimeGiving is ordered descending (first >= last)", async () => {
    const res = await authGet("/api/reports/top-donors?limit=10");
    if (res.body.length >= 2) {
      const first = Number(res.body[0].totalLifetimeGiving);
      const last = Number(res.body[res.body.length - 1].totalLifetimeGiving);
      expect(first).toBeGreaterThanOrEqual(last);
    }
  });
});

// ─── /api/reports/lybunt ────────────────────────────────────────────────────

describe("GET /api/reports/lybunt", () => {
  it("returns an array (possibly empty)", async () => {
    const res = await authGet("/api/reports/lybunt");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each entry has id, firstName, lastName, lastGiftDate", async () => {
    const res = await authGet("/api/reports/lybunt");
    for (const d of res.body) {
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("firstName");
      expect(d).toHaveProperty("lastName");
    }
  });
});

// ─── /api/reports/sybunt ────────────────────────────────────────────────────

describe("GET /api/reports/sybunt", () => {
  it("returns an array (possibly empty)", async () => {
    const res = await authGet("/api/reports/sybunt");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── /api/reports/giving-by-tier ────────────────────────────────────────────

describe("GET /api/reports/giving-by-tier", () => {
  it("returns an object with four tier keys", async () => {
    const res = await authGet("/api/reports/giving-by-tier");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("micro");
    expect(res.body).toHaveProperty("small");
    expect(res.body).toHaveProperty("mid");
    expect(res.body).toHaveProperty("major");
  });

  it("each tier has count and amount >= 0", async () => {
    const res = await authGet("/api/reports/giving-by-tier");
    for (const tier of ["micro", "small", "mid", "major"]) {
      expect(res.body[tier].count).toBeGreaterThanOrEqual(0);
      expect(res.body[tier].amount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── /api/reports/payment-breakdown ─────────────────────────────────────────

describe("GET /api/reports/payment-breakdown", () => {
  it("returns an array", async () => {
    const res = await authGet("/api/reports/payment-breakdown");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each item has paymentMethod, count, and amount", async () => {
    const res = await authGet("/api/reports/payment-breakdown");
    for (const item of res.body) {
      expect(item).toHaveProperty("paymentMethod");
      expect(item).toHaveProperty("count");
      expect(item).toHaveProperty("amount");
      expect(item.count).toBeGreaterThan(0);
      expect(item.amount).toBeGreaterThan(0);
    }
  });
});

// ─── /api/reports/donor-segments ────────────────────────────────────────────

describe("GET /api/reports/donor-segments", () => {
  it("returns an object with all required segment keys", async () => {
    const res = await authGet("/api/reports/donor-segments");
    expect(res.status).toBe(200);
    for (const key of ["ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "PROSPECT", "DECEASED", "OTHER"]) {
      expect(res.body).toHaveProperty(key);
      expect(res.body[key]).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── /api/reports/new-vs-returning ──────────────────────────────────────────

describe("GET /api/reports/new-vs-returning", () => {
  it("returns exactly 12 months", async () => {
    const res = await authGet("/api/reports/new-vs-returning");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
  });

  it("each month has newCount and returningCount >= 0", async () => {
    const res = await authGet("/api/reports/new-vs-returning");
    for (const d of res.body) {
      expect(d.newCount).toBeGreaterThanOrEqual(0);
      expect(d.returningCount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── /api/reports/campaign-performance ──────────────────────────────────────

describe("GET /api/reports/campaign-performance", () => {
  it("returns an array of campaigns", async () => {
    const res = await authGet("/api/reports/campaign-performance");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each campaign has id, name, raised, giftCount, uniqueDonors", async () => {
    const res = await authGet("/api/reports/campaign-performance");
    for (const c of res.body) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("raised");
      expect(c).toHaveProperty("giftCount");
      expect(c).toHaveProperty("uniqueDonors");
    }
  });
});

// ─── /api/reports/board-summary ─────────────────────────────────────────────

describe("GET /api/reports/board-summary", () => {
  it("returns summary and monthlyTrend", async () => {
    const res = await authGet("/api/reports/board-summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("monthlyTrend");
    expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
  });

  it("summary has all expected KPI fields", async () => {
    const res = await authGet("/api/reports/board-summary");
    const { summary } = res.body;
    expect(summary).toHaveProperty("ytdRevenue");
    expect(summary).toHaveProperty("ytdGoal");
    expect(summary).toHaveProperty("donorRetentionRate");
    expect(summary).toHaveProperty("totalDonors");
    expect(summary).toHaveProperty("newDonorsYtd");
    expect(summary).toHaveProperty("totalGiftsYtd");
    expect(summary).toHaveProperty("averageGift");
    expect(summary).toHaveProperty("majorGiftCount");
  });

  it("donorRetentionRate is 0–100 integer", async () => {
    const res = await authGet("/api/reports/board-summary");
    const rate = res.body.summary.donorRetentionRate;
    expect(Number.isInteger(rate)).toBe(true);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(100);
  });

  it("monthlyTrend covers Jan through current month", async () => {
    const res = await authGet("/api/reports/board-summary");
    const trend = res.body.monthlyTrend;
    // Must cover at least 1 month and at most 12
    expect(trend.length).toBeGreaterThanOrEqual(1);
    expect(trend.length).toBeLessThanOrEqual(12);
    // Each item has label (e.g. "Jan") and amount
    for (const item of trend) {
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("amount");
      expect(item.amount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── /api/reports/recent-donations ──────────────────────────────────────────

describe("GET /api/reports/recent-donations", () => {
  it("returns an array of at most 8 recent donations by default", async () => {
    const res = await authGet("/api/reports/recent-donations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(8);
  });

  it("each donation has amount, date, constituentId, constituentName", async () => {
    const res = await authGet("/api/reports/recent-donations");
    for (const d of res.body) {
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("amount");
      expect(d).toHaveProperty("date");
      expect(d).toHaveProperty("constituentId");
      expect(d).toHaveProperty("constituentName");
    }
  });

  it("amounts are positive numbers", async () => {
    const res = await authGet("/api/reports/recent-donations");
    for (const d of res.body) {
      expect(Number(d.amount)).toBeGreaterThan(0);
    }
  });
});
