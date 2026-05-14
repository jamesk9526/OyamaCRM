import { describe, expect, it } from "vitest";
import {
  buildWebmasterPublishReadinessReport,
  isValidWebmasterPagePath,
} from "@/server/src/services/webmaster-publish-readiness";

describe("webmaster publish readiness", () => {
  it("validates publish-safe paths", () => {
    expect(isValidWebmasterPagePath("/")).toBe(true);
    expect(isValidWebmasterPagePath("/about-us")).toBe(true);
    expect(isValidWebmasterPagePath("no-leading-slash")).toBe(false);
    expect(isValidWebmasterPagePath("/bad path")).toBe(false);
    expect(isValidWebmasterPagePath("/bad//path")).toBe(false);
  });

  it("flags blocking issues when home and seo are missing", () => {
    const report = buildWebmasterPublishReadinessReport({
      site: {
        id: "site-1",
        organizationId: "org-1",
        createdById: null,
        ownerId: null,
        name: "Test Site",
        slug: "test-site",
        siteType: "MAIN_SITE",
        sitePurpose: null,
        connectedModule: null,
        connectedRecordId: null,
        domain: null,
        subdomain: null,
        launchStatus: "NOT_READY",
        seoHealthScore: null,
        publishingTarget: null,
        launchDate: null,
        expiresAt: null,
        archivedAt: null,
        lastPublishedAt: null,
        publishedVersionId: null,
        description: null,
        status: "DRAFT",
        pageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      pages: [
        {
          id: "page-1",
          organizationId: "org-1",
          siteId: "site-1",
          siteName: "Test Site",
          createdById: null,
          updatedById: null,
          title: "Landing",
          slug: "landing",
          path: "/landing",
          status: "DRAFT",
          contentJson: null,
          seoTitle: null,
          seoDescription: null,
          publishedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(report.preflightPassed).toBe(false);
    expect(report.status).toBe("Broken");
    expect(report.pagesMissingSeo.length).toBe(1);
    expect(report.checks.some((check) => check.id === "home-page" && check.status === "Broken")).toBe(true);
  });

  it("passes preflight when required checks are satisfied", () => {
    const now = new Date().toISOString();
    const report = buildWebmasterPublishReadinessReport({
      site: {
        id: "site-2",
        organizationId: "org-1",
        createdById: null,
        ownerId: null,
        name: "Ready Site",
        slug: "ready-site",
        siteType: "MAIN_SITE",
        sitePurpose: null,
        connectedModule: null,
        connectedRecordId: null,
        domain: "ready.example.org",
        subdomain: null,
        launchStatus: "REVIEW_READY",
        seoHealthScore: 92,
        publishingTarget: "crm-hosted",
        launchDate: null,
        expiresAt: null,
        archivedAt: null,
        lastPublishedAt: now,
        publishedVersionId: "v3",
        description: null,
        status: "ACTIVE",
        pageCount: 1,
        createdAt: now,
        updatedAt: now,
      },
      pages: [
        {
          id: "page-2",
          organizationId: "org-1",
          siteId: "site-2",
          siteName: "Ready Site",
          createdById: null,
          updatedById: null,
          title: "Home",
          slug: "home",
          path: "/",
          status: "PUBLISHED",
          contentJson: null,
          seoTitle: "Home",
          seoDescription: "Home description",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(report.checks.some((check) => check.id === "site-not-archived" && check.status === "Working")).toBe(true);
    expect(report.checks.some((check) => check.id === "seo-required-fields" && check.status === "Working")).toBe(true);
    expect(report.preflightPassed).toBe(true);
    expect(report.previewLink).toContain("/webmaster/preview/site-2/page-2?draft=1");
    expect(report.publishExecutionStatus).toBe("Working");
    expect(report.rollbackStatus).toBe("Working");
  });
});
