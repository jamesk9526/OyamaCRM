/**
 * Safe build/runtime metadata for the Express API health endpoints.
 * Values come from environment variables with conservative development fallbacks.
 */

export interface AppInfo {
  appName: string;
  version: string;
  buildDate: string;
  gitCommit: string;
  releaseChannel: string;
  environment: string;
  lastAuditDate: string;
}

/** Returns non-secret application metadata suitable for health and status responses. */
export function getAppInfo(env: NodeJS.ProcessEnv = process.env): AppInfo {
  return {
    appName: env.APP_NAME ?? "OyamaCRM v1.3",
    version: env.APP_VERSION ?? env.npm_package_version ?? "0.1.0",
    buildDate: env.BUILD_DATE ?? "2026-05-08",
    gitCommit: env.GIT_COMMIT ?? "local-dev",
    releaseChannel: env.RELEASE_CHANNEL ?? "development",
    environment: env.NODE_ENV ?? "development",
    lastAuditDate: env.LAST_AUDIT_DATE ?? "2026-05-08",
  };
}
