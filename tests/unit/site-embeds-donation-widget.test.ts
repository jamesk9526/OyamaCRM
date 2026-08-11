import { describe, expect, it } from "vitest";
import {
  buildDefaultSiteEmbedSiteConfig,
  buildSiteEmbedLoaderScript,
  buildSiteEmbedSnippets,
  getDonationDomainConfigurationIssues,
  isDomainAllowedForSite,
  isValidEmbedDomainPattern,
  parseSiteEmbedsConfig,
  toPublicSiteEmbedConfig,
} from "../../server/src/services/site-embeds";
import { normalizePublicApiRootUrl } from "../../server/src/lib/public-api-url";

describe("Stripe donation widget configuration", () => {
  it("provides nonprofit-safe defaults and installable variants", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    const widget = site.widgets.donation_widget;

    expect(widget.allowCustomAmount).toBe(true);
    expect(widget.hostedPageEnabled).toBe(false);
    expect(widget.customAmountLabel).toBe("Other");
    expect(widget.requireDonorName).toBe(true);
    expect(widget.maximumAmountCents).toBeGreaterThan(widget.minimumAmountCents);
    expect(widget.stylePreset).toBe("classic");
    expect(buildSiteEmbedSnippets(site, "https://crm.example.org").embedBlocks.donation_widget)
      .toContain('<div data-oyama-embed="donation-widget"></div>');
  });

  it("normalizes legacy and hostile amount/style values", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    const parsed = parseSiteEmbedsConfig({
      version: 2,
      selectedSiteId: site.id,
      sites: [{
        ...site,
        widgets: {
          ...site.widgets,
          donation_widget: {
            ...site.widgets.donation_widget,
            minimumAmountCents: 2500,
            maximumAmountCents: 100,
            stylePreset: "unknown",
            formWidth: "enormous",
            buttonLabel: "Donate now".repeat(20),
          },
        },
      }],
    });
    const widget = parsed.sites[0].widgets.donation_widget;

    expect(widget.maximumAmountCents).toBe(2500);
    expect(widget.stylePreset).toBe("classic");
    expect(widget.formWidth).toBe("standard");
    expect(widget.buttonLabel.length).toBeLessThanOrEqual(80);
  });

  it("ships runtime support for custom amount controls and embed style overrides", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    const script = buildSiteEmbedLoaderScript({
      token: site.embedToken,
      apiBaseUrl: "https://crm.example.org",
      publicConfig: toPublicSiteEmbedConfig(site),
    });

    expect(script).toContain("data-oyama-style");
    expect(script).toContain("allowCustomAmount");
    expect(script).toContain("el('form'");
    expect(script).toContain("aria-label': 'Secure donation form");
    expect(script).toContain("type: 'submit'");
  });

  it("requires a restricted, valid domain before enabling a donation form", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    site.widgets.donation_widget.enabled = true;

    expect(getDonationDomainConfigurationIssues(site)).toContain(
      "Add a primary domain or at least one allowed domain before enabling the donation form.",
    );

    site.primaryDomain = "give.example.org";
    site.allowedDomains = ["www.example.org", "*.campaigns.example.org"];
    expect(getDonationDomainConfigurationIssues(site)).toEqual([]);
    expect(isDomainAllowedForSite(site, "give.example.org")).toBe(true);
    expect(isDomainAllowedForSite(site, "spring.campaigns.example.org")).toBe(true);
    expect(isDomainAllowedForSite(site, "attacker.example.net")).toBe(false);
  });

  it("rejects unrestricted or malformed donation domain patterns", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    site.primaryDomain = "give.example.org";
    site.allowedDomains = ["*"];

    expect(getDonationDomainConfigurationIssues(site).join(" ")).toContain("cannot use the unrestricted * domain");
    expect(isValidEmbedDomainPattern("*.campaigns.example.org")).toBe(true);
    expect(isValidEmbedDomainPattern("not a domain")).toBe(false);
  });

  it("allows a hosted-only giving page without weakening external embed checks", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    site.widgets.donation_widget.enabled = true;
    site.widgets.donation_widget.hostedPageEnabled = true;

    expect(getDonationDomainConfigurationIssues(site, { requireConfigured: false })).toEqual([]);
    expect(getDonationDomainConfigurationIssues(site)).not.toEqual([]);
  });

  it("canonicalizes production API URLs before generating loader and callback paths", () => {
    const site = buildDefaultSiteEmbedSiteConfig();
    const configuredUrl = "https://www.crm.partnertpcc.com/api/api/";
    const snippets = buildSiteEmbedSnippets(site, configuredUrl);
    const loader = buildSiteEmbedLoaderScript({
      token: site.embedToken,
      apiBaseUrl: configuredUrl,
      publicConfig: toPublicSiteEmbedConfig(site),
    });

    expect(normalizePublicApiRootUrl(configuredUrl)).toBe("https://www.crm.partnertpcc.com");
    expect(snippets.headSnippet).toContain("https://www.crm.partnertpcc.com/api/site-embeds/loader.js");
    expect(snippets.headSnippet).not.toContain("/api/api/");
    expect(loader).toContain("apiBaseUrl: 'https://www.crm.partnertpcc.com'");
    expect(loader).not.toContain("https://www.crm.partnertpcc.com/api/api/");
  });
});
