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

import OAuthClient from "intuit-oauth";
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

// ─── OAuthClient factory ──────────────────────────────────────────────────────

/**
 * Creates a new OAuthClient configured from environment variables.
 * The client is stateless — tokens are stored externally in the DB.
 */
function createOAuthClient(): InstanceType<typeof OAuthClient> {
  const clientId = process.env.QB_CLIENT_ID ?? "";
  const clientSecret = process.env.QB_CLIENT_SECRET ?? "";
  const redirectUri = process.env.QB_REDIRECT_URI ?? "http://localhost:4000/api/quickbooks/callback";
  const environment = (process.env.QB_ENVIRONMENT ?? "sandbox") as "sandbox" | "production";

  if (!clientId || !clientSecret) {
    // Log a warning — the plugin will show as "not configured" in the UI
    console.warn("[QB] QB_CLIENT_ID or QB_CLIENT_SECRET not set. QuickBooks features will be unavailable.");
  }

  return new OAuthClient({
    clientId,
    clientSecret,
    environment,
    redirectUri,
    logging: process.env.NODE_ENV !== "production",
  });
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if QB OAuth credentials are present in the environment.
 * If false, the plugin cannot be used regardless of enabled status.
 */
export function isQBConfigured(): boolean {
  return !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
}

/**
 * Builds the QuickBooks authorization URL to redirect the user to for OAuth consent.
 * The state param is the organizationId so we can route the callback correctly.
 */
export function buildAuthUri(organizationId: string): string {
  const client = createOAuthClient();
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
  const client = createOAuthClient();

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
  await prisma.pluginSetting.upsert({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
    create: {
      organizationId,
      pluginKey: "quickbooks",
      enabled: true,
      config: payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: payload as unknown as Prisma.InputJsonValue,
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
): Promise<InstanceType<typeof OAuthClient>> {
  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });

  if (!plugin?.config) {
    throw new Error("QuickBooks is not connected for this organization.");
  }

  const stored = plugin.config as unknown as QBTokenPayload;
  const client = createOAuthClient();

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
      data: { config: updatedPayload as unknown as Prisma.InputJsonValue },
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
    data: { config: null as unknown as Prisma.InputJsonValue },
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
  const client = await getAuthorizedClient(organizationId);
  const plugin = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });
  const stored = plugin?.config as unknown as QBTokenPayload | null;
  const realmId = stored?.realmId ?? "";

  const env = process.env.QB_ENVIRONMENT ?? "sandbox";
  const baseUrl = env === "production"
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
