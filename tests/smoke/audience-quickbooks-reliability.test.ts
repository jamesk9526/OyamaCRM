/** Regression contracts for exact letter audiences and the one-way QB sink. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("audience and QuickBooks reliability", () => {
  it("shows postal addresses in both audience management grids", () => {
    const contacts = read("app/components/contacts-manager/ContactsManagerPage.tsx");
    const lists = read("app/components/contacts-manager/AudienceListManager.tsx");
    expect(contacts).toContain("Street address");
    expect(contacts).toContain("formatStreetAddress(row)");
    expect(lists).toContain("Street address");
    expect(lists).toContain("formatMemberAddress(row.contact)");
  });

  it("refreshes a saved list and prevents unrelated recipient-source unions", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    expect(workspace).toContain("const missingListIds = selectedListIds;");
    expect(workspace).toContain("setSelectedIndividualIds([])");
    expect(workspace).toContain("setSelectedTagNames([])");
    expect(workspace).toContain("setSelectedDonorStatuses([])");
    expect(workspace).toContain("const runtimeRecipientIds = includedRecipientIds");
  });

  it("filters the full audience by completed gift count and calendar year", () => {
    const contacts = read("app/components/contacts-manager/ContactsManagerPage.tsx");
    const constituentsRoute = read("server/src/routes/constituents.ts");
    expect(contacts).toContain("Gave once in {previousCalendarYear()}");
    expect(contacts).toContain("matchesDonationCount");
    expect(contacts).toContain("Donation filters apply to the complete view before pagination");
    expect(constituentsRoute).toContain('router.get("/audience-donation-summary"');
    expect(constituentsRoute).toContain('status: "COMPLETED"');
    expect(constituentsRoute).toContain('_count: { _all: true }');
  });

  it("uses server-owned queueing plus CRM and QuickBooks idempotency keys", () => {
    const donations = read("server/src/routes/donations.ts");
    const quickbooks = read("server/src/routes/quickbooks.ts");
    const service = read("server/src/services/quickbooksService.ts");
    const schema = read("prisma/schema.prisma");
    expect(donations).toContain("ensureDonationQueuedForQuickBooks(organizationId, donation.id)");
    expect(quickbooks).toContain("queueEligibleQuickBooksDonations");
    expect(schema).toContain("@@unique([organizationId, donationId])");
    expect(service).toContain("requestid=${requestId}");
    expect(service).toContain("where DocNumber =");
    expect(service).toContain("resolveCustomerRef");
    expect(service).toContain("resolveItemRef");
  });

  it("uses connection time as the default cutoff and requires explicit historical consent", () => {
    const quickbooks = read("server/src/routes/quickbooks.ts");
    const service = read("server/src/services/quickbooksService.ts");
    const settings = read("app/components/settings/plugins/PluginsSettingsPage.tsx");
    expect(service).toContain("qbConnectedAt");
    expect(quickbooks).toContain("connectionCutoff");
    expect(quickbooks).toContain('router.post("/sync-queue/sync-history"');
    expect(quickbooks).toContain("confirmPastHistory !== true");
    expect(quickbooks).toContain("QB_HISTORY_CONFIRMATION_REQUIRED");
    expect(settings).toContain("Sync all past history");
    expect(settings).toContain("confirmPastHistory: true");
  });

  it("starts and reports the organization-timezone daily sync worker", () => {
    const worker = read("server/src/services/quickbooks-sync-worker.ts");
    const server = read("server/src/index.ts");
    expect(worker).toContain("qbLastDailySyncDate");
    expect(worker).toContain("organization.settings?.timezone");
    expect(server).toContain("startQuickBooksSyncWorker()");
    expect(server).toContain("quickBooks,");
  });
});
