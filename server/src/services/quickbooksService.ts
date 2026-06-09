/**
 * quickbooksService.ts
 * Wraps the intuit-oauth library to provide QuickBooks OAuth2 and API call helpers.
 * Manages token storage/retrieval from the database and exposes methods for
 * initiating the OAuth flow, handling callbacks, refreshing tokens, and
 * pushing donation records to QuickBooks as Sales Receipts.
 *
 * IMPORTANT: This service only handles the technical OAuth/API layer.
 * Business logic (queue management, sync orchestration) lives in the route handler.
 */

import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Stored token shape persisted in PluginSetting.config */
export interface QBTokenPayload {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  realmId: string; // QuickBooks company ID
  createdAt: number; // epoch ms
}

/** Donation data shape needed to create a QB Sales Receipt */
export interface QBDonationPayload {
  customerName: string;
  amount: number;
  memo?: string;
  qbAccount?: string;
  date: string; // YYYY-MM-DD
}

interface QBCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
  source: "env" | "plugin";
}

const DEFAULT_REDIRECT_URI = "http://localhost:4000/api/quickbooks/callback";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readTokenPayload(config: unknown): QBTokenPayload | null {
  const candidate = asRecord(config);
  if (!candidate.access_token || !candidate.refresh_token) return null;
  return {
    token_type: String(candidate.token_type ?? "bearer"),
    access_token: String(candidate.access_token),
    refresh_token: String(candidate.refresh_token),
    expires_in: Number(candidate.expires_in ?? 3600),
    x_refresh_token_expires_in: Number(candidate.x_refresh_token_expires_in ?? 8726400),
    realmId: String(candidate.realmId ?? ""),
    createdAt: Number(candidate.createdAt ?? Date.now()),
  };
}

function mergeConfig(existingConfig: unknown, partial: Record<string, unknown>): Record<string, unknown> {
  return {
    ...asRecord(existingConfig),
    ...partial,
  };
}

function readPluginCredentials(config: unknown): QBCredentials | null {
  const candidate = asRecord(config);
  const clientId = String(candidate.qbClientId ?? "").trim();
  const clientSecret = String(candidate.qbClientSecret ?? "").trim();
  if (!clientId || !clientSecret) return null;

  const redirectUri = String(candidate.qbRedirectUri ?? DEFAULT_REDIRECT_URI).trim() || DEFAULT_REDIRECT_URI;
  const environment = String(candidate.qbEnvironment ?? "sandbox") === "production" ? "production" : "sandbox";

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    source: "plugin",
  };
}

function readEnvCredentials(): QBCredentials | null {
  const clientId = String(process.env.QB_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.QB_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: String(process.env.QB_REDIRECT_URI ?? DEFAULT_REDIRECT_URI),
    environment: (process.env.QB_ENVIRONMENT ?? "sandbox") === "production" ? "production" : "sandbox",
    source: "env",
  };
}

async function resolveCredentials(organizationId: string): Promise<QBCredentials | null> {
  const envCredentials = readEnvCredentials();
  if (envCredentials) return envCredentials;

  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
    select: { config: true },
  });

  return readPluginCredentials(plugin?.config);
}

// ─── OAuthClient factory ──────────────────────────────────────────────────────

/**
 * Creates a new OAuthClient configured from environment variables.
 * The client is stateless — tokens are stored externally in the DB.
 */
async function createOAuthClient(credentials: QBCredentials) {
  const { default: OAuthClient } = await import("intuit-oauth");
  return new OAuthClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    environment: credentials.environment,
    redirectUri: credentials.redirectUri,
    logging: process.env.NODE_ENV !== "production",
  });
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if QB OAuth credentials are present in the environment.
 * If false, the plugin cannot be used regardless of enabled status.
 */
export async function isQBConfigured(organizationId: string): Promise<boolean> {
  const credentials = await resolveCredentials(organizationId);
  return Boolean(credentials);
}

export async function getQBRuntimeStatus(organizationId: string): Promise<{
  configured: boolean;
  source: "env" | "plugin" | null;
  environment: "sandbox" | "production";
  redirectUri: string;
  clientIdPreview: string | null;
}> {
  const credentials = await resolveCredentials(organizationId);
  if (!credentials) {
    return {
      configured: false,
      source: null,
      environment: "sandbox",
      redirectUri: DEFAULT_REDIRECT_URI,
      clientIdPreview: null,
    };
  }

  return {
    configured: true,
    source: credentials.source,
    environment: credentials.environment,
    redirectUri: credentials.redirectUri,
    clientIdPreview: credentials.clientId.length > 6
      ? `${credentials.clientId.slice(0, 3)}...${credentials.clientId.slice(-3)}`
      : credentials.clientId,
  };
}

export async function saveQBPluginCredentials(params: {
  organizationId: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  environment?: "sandbox" | "production";
}): Promise<void> {
  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId: params.organizationId, pluginKey: "quickbooks" } },
  });

  const mergedConfig = mergeConfig(plugin?.config, {
    qbClientId: params.clientId.trim(),
    qbClientSecret: params.clientSecret.trim(),
    qbRedirectUri: (params.redirectUri ?? DEFAULT_REDIRECT_URI).trim() || DEFAULT_REDIRECT_URI,
    qbEnvironment: params.environment ?? "sandbox",
  });

  await prisma.pluginSetting.upsert({
    where: { organizationId_pluginKey: { organizationId: params.organizationId, pluginKey: "quickbooks" } },
    create: {
      organizationId: params.organizationId,
      pluginKey: "quickbooks",
      enabled: plugin?.enabled ?? false,
      config: mergedConfig as Prisma.InputJsonValue,
    },
    update: {
      config: mergedConfig as Prisma.InputJsonValue,
    },
  });
}

/**
 * Builds the QuickBooks authorization URL to redirect the user to for OAuth consent.
 * The state param is the organizationId so we can route the callback correctly.
 */
export async function buildAuthUri(organizationId: string): Promise<string> {
  const credentials = await resolveCredentials(organizationId);
  if (!credentials) {
    throw new Error("QuickBooks runtime credentials are missing.");
  }
  const { default: OAuthClient } = await import("intuit-oauth");
  const client = await createOAuthClient(credentials);
  return client.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: organizationId,
  });
}

/**
 * Handles the OAuth callback URL after the user consents.
 * Exchanges the authorization code for tokens and stores them in the DB.
 * @param callbackUrl - The full callback URL including query string
 * @param organizationId - The org to associate the tokens with
 */
export async function handleOAuthCallback(
  callbackUrl: string,
  organizationId: string
): Promise<QBTokenPayload> {
  const credentials = await resolveCredentials(organizationId);
  if (!credentials) {
    throw new Error("QuickBooks runtime credentials are missing.");
  }

  const client = await createOAuthClient(credentials);

  // Exchange the auth code for tokens
  const authResponse = await client.createToken(callbackUrl);
  const rawToken = authResponse.getToken() as Record<string, unknown>;

  const payload: QBTokenPayload = {
    token_type: String(rawToken.token_type ?? "bearer"),
    access_token: String(rawToken.access_token ?? ""),
    refresh_token: String(rawToken.refresh_token ?? ""),
    expires_in: Number(rawToken.expires_in ?? 3600),
    x_refresh_token_expires_in: Number(rawToken.x_refresh_token_expires_in ?? 8726400),
    realmId: String(rawToken.realmId ?? ""),
    createdAt: Date.now(),
  };

  // Persist tokens — upsert so reconnecting overwrites old tokens
  const existing = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });

  const mergedConfig = mergeConfig(existing?.config, payload as unknown as Record<string, unknown>);

  await prisma.pluginSetting.upsert({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
    create: {
      organizationId,
      pluginKey: "quickbooks",
      enabled: true,
      config: mergedConfig as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: mergedConfig as Prisma.InputJsonValue,
    },
  });

  return payload;
}

/**
 * Loads stored QB tokens for an org, refreshes if expired, and returns a live OAuthClient.
 * Throws if no tokens exist or refresh fails.
 */
export async function getAuthorizedClient(
  organizationId: string
): Promise<any> {
  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });

  if (!plugin?.config) {
    throw new Error("QuickBooks is not connected for this organization.");
  }

  const stored = readTokenPayload(plugin.config);
  if (!stored) {
    throw new Error("QuickBooks is not connected for this organization.");
  }

  const credentials = await resolveCredentials(organizationId);
  if (!credentials) {
    throw new Error("QuickBooks runtime credentials are missing.");
  }

  const client = await createOAuthClient(credentials);

  // Restore stored tokens into the client
  client.setToken({
    token_type: stored.token_type,
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expires_in: stored.expires_in,
    x_refresh_token_expires_in: stored.x_refresh_token_expires_in,
    realmId: stored.realmId,
    createdAt: stored.createdAt,
  });

  // Refresh if the access token is expired (client checks internally)
  if (!client.isAccessTokenValid()) {
    const refreshResponse = await client.refresh();
    const refreshed = refreshResponse.getToken() as Record<string, unknown>;

    const updatedPayload: QBTokenPayload = {
      ...stored,
      access_token: String(refreshed.access_token ?? ""),
      refresh_token: String(refreshed.refresh_token ?? stored.refresh_token),
      expires_in: Number(refreshed.expires_in ?? 3600),
      createdAt: Date.now(),
    };

    // Persist the refreshed tokens
    await prisma.pluginSetting.update({
      where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
      data: {
        config: mergeConfig(plugin.config, updatedPayload as unknown as Record<string, unknown>) as Prisma.InputJsonValue,
      },
    });

    client.setToken(updatedPayload as unknown as Record<string, unknown>);
  }

  return client;
}

/**
 * Revokes the QB OAuth tokens and marks the plugin as disconnected.
 * Does not disable the plugin — just removes the credentials.
 */
export async function revokeTokens(organizationId: string): Promise<void> {
  try {
    const client = await getAuthorizedClient(organizationId);
    await client.revoke();
  } catch {
    // Ignore revoke errors — token may already be expired
  }

  await prisma.pluginSetting.update({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
    data: {
      config: mergeConfig((await prisma.pluginSetting.findUnique({
        where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
        select: { config: true },
      }))?.config, {
        token_type: null,
        access_token: null,
        refresh_token: null,
        expires_in: null,
        x_refresh_token_expires_in: null,
        realmId: null,
        createdAt: null,
      }) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Pushes a single donation to QuickBooks as a Sales Receipt.
 * Returns the QB entity ID on success.
 * @throws OAuthError, NetworkError, or ValidationError from intuit-oauth on failure.
 */
export async function pushDonationToQB(
  organizationId: string,
  donation: QBDonationPayload
): Promise<string> {
  const credentials = await resolveCredentials(organizationId);
  if (!credentials) {
    throw new Error("QuickBooks runtime credentials are missing.");
  }

  const client = await getAuthorizedClient(organizationId);
  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });
  const stored = plugin?.config as unknown as QBTokenPayload | null;
  const realmId = stored?.realmId ?? "";

  const baseUrl = credentials.environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";

  // Build a minimal QB Sales Receipt payload.
  // The "Line" item maps to a donation income account.
  const receiptBody = {
    Line: [
      {
        Amount: donation.amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          // QB requires an ItemRef — "1" is the default "Services" item in sandbox
          ItemRef: { value: "1", name: "Services" },
        },
        Description: donation.memo ?? "Donation",
      },
    ],
    CustomerRef: {
      // QB looks up by name; org should map donors to QB customers before syncing
      name: donation.customerName,
    },
    TxnDate: donation.date,
    PrivateNote: donation.memo ?? undefined,
  };

  const url = `${baseUrl}/v3/company/${realmId}/salesreceipt?minorversion=65`;
  const response = await client.makeApiCall({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(receiptBody),
  });

  // Both response.json and response.data are supported (see intuit-oauth 4.2.3 FAQ)
  const data = (response.json ?? (response as unknown as { data: unknown }).data) as { SalesReceipt?: { Id?: string } };
  const entityId = data?.SalesReceipt?.Id ?? "";

  if (!entityId) {
    throw new Error("QuickBooks returned a response but no entity ID — check QB company configuration.");
  }

  return entityId;
}
