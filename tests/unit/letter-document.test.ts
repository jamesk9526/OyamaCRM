import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING_SETTINGS } from "@/app/lib/branding-settings";
import { buildLetterBrandingSnapshot, buildLetterDocument } from "@/app/lib/letters/letter-document";

describe("letter document model", () => {
  it("builds a normalized branding snapshot from global branding settings", () => {
    const snapshot = buildLetterBrandingSnapshot({
      ...DEFAULT_BRANDING_SETTINGS,
      primaryColor: "#123456",
      accentColor: "#abcdef",
      organizationDisplayName: "Oyama Ministries",
      legalOrganizationName: "Oyama Ministries Inc.",
      tagline: "Letters that serve donors",
      contactEmail: "office@example.org",
      contactPhone: "555-0100",
      websiteUrl: "https://example.org",
      streetAddress1: "100 Main St",
      city: "Chicago",
      stateProvince: "IL",
      postalCode: "60601",
    });

    expect(snapshot).toMatchObject({
      primaryColor: "#123456",
      accentColor: "#abcdef",
      organizationName: "Oyama Ministries",
      legalOrganizationName: "Oyama Ministries Inc.",
      tagline: "Letters that serve donors",
      contactEmail: "office@example.org",
      contactPhone: "555-0100",
      websiteUrl: "https://example.org",
      address: "100 Main St • Chicago, IL • 60601",
    });
  });

  it("creates a printable letter document with explicit recipient and sender data", () => {
    const document = buildLetterDocument({
      id: "letter-1",
      templateId: "template-1",
      title: "Annual thank-you",
      generatedAtIso: "2026-06-13T12:00:00.000Z",
      branding: {
        ...DEFAULT_BRANDING_SETTINGS,
        organizationDisplayName: "Oyama Ministries",
        defaultLetterClosingPhrase: "In gratitude,",
      },
      recipient: {
        displayName: "Jane Donor",
        addressLine1: "200 Oak Ave",
        city: "Tulsa",
        state: "OK",
        postalCode: "74103",
      },
      sender: {
        name: "James",
        title: "Director",
        email: "james@example.org",
      },
      subject: "Thank you",
      bodyHtml: "<p>Your generosity matters.</p>",
    });

    expect(document.workspace).toBe("oyamaLetters");
    expect(document.recipient.displayName).toBe("Jane Donor");
    expect(document.sender.name).toBe("James");
    expect(document.content.subject).toBe("Thank you");
    expect(document.content.closing).toBe("In gratitude,");
    expect(document.layout).toMatchObject({
      marginTop: 0.25,
      marginRight: 0.25,
      marginBottom: 0.25,
      marginLeft: 0.25,
    });
    expect(document.footer.blocks).toContainEqual({ label: "Email", text: "james@example.org" });
    expect(document.diagnostics).toMatchObject({
      usesSampleRecipient: false,
      hasBodyHtml: true,
      hasBrandingConfigured: true,
    });
  });

  it("marks sample recipient output when no recipient is available", () => {
    const document = buildLetterDocument({
      id: "preview",
      title: "Draft Preview",
      bodyHtml: "",
      branding: DEFAULT_BRANDING_SETTINGS,
    });

    expect(document.recipient.displayName).toBe("Sample Preview Recipient");
    expect(document.diagnostics).toMatchObject({
      usesSampleRecipient: true,
      hasBodyHtml: false,
      hasBrandingConfigured: false,
    });
  });
});
