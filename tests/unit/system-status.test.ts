import { describe, expect, it } from "vitest";

import {
  AUDIT_DATE,
  FEATURE_READINESS,
  getFeatureStatusCounts,
  getPublicBuildInfo,
  OVERALL_READINESS_SCORE,
} from "@/app/lib/system-status";

describe("system-status metadata", () => {
  it("returns safe public build info defaults", () => {
    expect(getPublicBuildInfo({} as NodeJS.ProcessEnv)).toEqual({
      appName: "OyamaCRM",
      version: "0.1.0",
      buildDate: AUDIT_DATE,
      gitCommit: "local-dev",
      releaseChannel: "development",
      environment: "development",
      lastAuditDate: AUDIT_DATE,
    });
  });

  it("prefers explicit environment values when present", () => {
    expect(
      getPublicBuildInfo({
        NEXT_PUBLIC_APP_NAME: "Custom OyamaCRM",
        NEXT_PUBLIC_APP_VERSION: "1.2.3",
        NEXT_PUBLIC_BUILD_DATE: "2026-05-09",
        NEXT_PUBLIC_GIT_COMMIT: "abc1234",
        NEXT_PUBLIC_RELEASE_CHANNEL: "staging",
        NEXT_PUBLIC_APP_ENV: "test",
        NEXT_PUBLIC_LAST_AUDIT_DATE: "2026-05-10",
      } as unknown as NodeJS.ProcessEnv)
    ).toMatchObject({
      appName: "Custom OyamaCRM",
      version: "1.2.3",
      buildDate: "2026-05-09",
      gitCommit: "abc1234",
      releaseChannel: "staging",
      environment: "test",
      lastAuditDate: "2026-05-10",
    });
  });

  it("counts feature readiness statuses and exposes a meaningful readiness score", () => {
    const counts = getFeatureStatusCounts(FEATURE_READINESS);

    expect(counts.Working).toBeGreaterThan(0);
    expect(counts.Partial).toBeGreaterThan(0);
    expect(counts["Not Started"]).toBeGreaterThan(0);
    expect(OVERALL_READINESS_SCORE).toBeGreaterThanOrEqual(50);
  });
});
