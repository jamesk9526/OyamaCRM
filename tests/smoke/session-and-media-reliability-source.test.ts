import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("browser session and media reliability source contract", () => {
  it("keeps browser auth and setup checks on the same-origin API proxy", () => {
    const authClient = read("app/lib/auth-client.ts");
    const login = read("app/login/page.tsx");
    const setup = read("app/setup/page.tsx");

    expect(authClient).toContain('typeof window !== "undefined" && path.startsWith("/")');
    expect(authClient).toContain('apiRequestUrl("/api/auth/refresh")');
    expect(authClient).toContain("res.status === 409");
    expect(login).toContain('apiRequestUrl("/api/setup/status")');
    expect(setup).toContain('apiRequestUrl("/api/setup/status")');
    expect(setup).toContain('apiRequestUrl("/api/setup/complete")');
    expect(login).not.toContain("${API}/api/setup/status");
  });

  it("starts authenticated background services only after session restoration", () => {
    const plugins = read("app/components/plugins/PluginProvider.tsx");
    const topBar = read("app/components/layout/TopBar.tsx");
    const authRoutes = read("server/src/routes/auth.ts");

    expect(plugins).toContain("if (authLoading)");
    expect(plugins).toContain("if (!user)");
    expect(plugins).toContain("apiFetch<{");
    expect(topBar).toContain('apiFetchResponse("/api/notifications/sse"');
    expect(topBar).not.toContain("new EventSource");
    expect(authRoutes).toContain('code: "REFRESH_ROTATED"');
    expect(authRoutes).toContain("res.status(204).end()");
  });

  it("suppresses stale local branding URLs and gives charts measurable minimums", () => {
    const brandingAssets = read("server/src/lib/branding-assets.ts");
    const settings = read("server/src/routes/settings.ts");
    const reports = read("app/components/donor-reports/DonorReportsSpreadsheet.tsx");

    expect(brandingAssets).toContain("usableBrandingAssetUrl");
    expect(brandingAssets).toContain("await access(assetPath)");
    expect(settings).toContain("usableBrandingAssetUrl(normalized.logoUrl");
    expect(reports).toContain('minWidth={0} minHeight={200}');
  });
});
