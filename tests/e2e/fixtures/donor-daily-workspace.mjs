/** Explicit browser-only fixtures. Never installed in the application or persisted. */
export async function installDonorWorkspaceFixtures(page) {
  const rows = [
    { id: "qa-person", firstName: "QA", lastName: "Individual", type: "DONOR", entityKind: "INDIVIDUAL", donorStatus: "ACTIVE" },
    { id: "qa-org", firstName: "QA", lastName: "Organization", organizationName: "QA Foundation", type: "FOUNDATION", entityKind: "ORGANIZATION", donorStatus: "ACTIVE" },
    { id: "qa-household", firstName: "QA", lastName: "Household", type: "HOUSEHOLD", entityKind: "HOUSEHOLD", donorStatus: "LAPSED" },
    { id: "qa-restricted", firstName: "QA", lastName: "Restricted", type: "DONOR", entityKind: "INDIVIDUAL", donorStatus: "ACTIVE", doNotContact: true },
  ].map((row) => ({
    email: "qa@example.test", phone: "555-0100", city: "Chicago", state: "IL", country: "US",
    addressLine1: "1 QA Street", zip: "60601", totalLifetimeGiving: "250.00", totalYtdGiving: "250.00",
    lastGiftDate: "2026-09-20", lastGiftAmount: "250.00", giftCount: 1, engagementScore: 50,
    createdAt: "2026-01-01T00:00:00Z", doNotEmail: false, doNotCall: false, doNotMail: false,
    doNotContact: false, emailOptOut: false, tags: [], groupMemberships: [], primaryForGroups: [],
    tasks: [], activities: [], donations: [], ...row,
  }));
  const gift = { id: "qa-gift", amount: "250.00", date: "2026-09-20", status: "COMPLETED", paymentMethod: "CHECK", isRecurring: true, frequency: "MONTHLY", taxDeductible: true, taxDeductibleAmount: "250.00", acknowledgmentSentAt: null, constituent: rows[0], designation: { id: "qa-fund", name: "QA Fund" } };
  rows[0].donations = [{ ...gift, constituent: undefined }];
  const household = { id: "qa-household-members", name: "QA Household", members: [], head: { id: rows[2].id, firstName: rows[2].firstName, lastName: rows[2].lastName } };
  rows[2].headOf = household;
  const summary = { totalConstituents: 4, activeDonors: 3, ytdAmount: 250, ytdCount: 1, ytdGrantAmount: 0, activeCampaignRaisedAmount: 0, weekAmount: 250, weekCount: 1, weekAvg: 250, monthAmount: 250, monthCount: 1, momTrend: null, pendingTasks: 1, overdueTasks: 1, activeCampaigns: 0, activeGoalTotal: 0, newDonorsThisMonth: 1 };
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const name = url.pathname;
    let body;
    if (name === "/api/constituents") {
      let matches = rows.filter((row) => (!url.searchParams.get("status") || row.donorStatus === url.searchParams.get("status")) && (!url.searchParams.get("type") || row.type === url.searchParams.get("type")));
      const query = (url.searchParams.get("search") ?? "").toLowerCase();
      matches = matches.filter((row) => `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(query));
      body = { items: matches, page: 1, pageSize: 100, total: matches.length, totalPages: matches.length ? 1 : 0 };
    } else if (name.startsWith("/api/constituents/merge-history/")) body = { merge: null };
    else if (/^\/api\/constituents\/qa-[^/]+$/.test(name)) body = rows.find((row) => name.endsWith(`/${row.id}`));
    else if (name === "/api/donations") body = { items: [gift], total: 1 };
    else if (name === "/api/donations/stats") body = { totalRaised: 250, totalGifts: 1, completed: 1, recurring: 1 };
    else if (name === "/api/reports/summary") body = summary;
    else if (name === "/api/reports/donor-retention") body = { retained: 1, total: 1, rate: 100 };
    else if (name === "/api/reports/giving-trend") body = { points: [], total: 250, giftCount: 1 };
    else if (name === "/api/reports/designations-summary") body = { slices: [{ name: "QA Fund", amount: 250 }], total: 250 };
    else if (name === "/api/campaigns") body = [];
    else if (name === "/api/designations") body = [{ id: "qa-fund", name: "QA Fund" }];
    else if (name === "/api/settings/dashboard-appearance") body = {};
    else if (name.startsWith("/api/letters/constituents/")) body = [];
    else if (name.startsWith("/api/email/subscriptions/by-constituent/")) body = { subscription: null, categoryPreferences: [], suppressions: [] };
    else if (name === "/api/steward-paths/templates" || name === "/api/steward-paths/enrollments") body = [];
    else if (name.startsWith("/api/steward-signals/donors/")) body = { constituentId: "qa-person", donorName: "QA Individual", generosityScore: 50, opportunityScore: 50, lapseRisk: "LOW", bestNextStep: "Review relationship", bestChannel: "EMAIL", confidence: 50, explanation: "QA fixture", lastGiftDate: "2026-09-20", lastGiftAmount: 250, totalLifetimeGiving: 250, giftCount: 1, inDevelopmentNote: "" };
    else if (name === "/api/households/qa-household-members") body = { ...household, head: undefined };
    if (body === undefined) return route.continue();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
}
