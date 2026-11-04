import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { v5 as uuidv5 } from "uuid";
import type { CreateConnection } from "@prisma/client";
import { decryptCredential, encryptCredential } from "../services/credential-encryption.js";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { CreateError, object, required, string } from "./domain.js";

export class ProviderError extends Error {
  constructor(message: string, public ambiguous: boolean) { super(message); }
}
type AzureConfig = { endpoint: string; sender: string; topic: string; eventGridVerified: boolean };
type MetaAccount = { id: string; name: string; instagramId: string; instagramName: string };
export function azureConfig(raw: unknown): AzureConfig {
  const input = object(raw); const endpoint = required(input.endpoint, "Azure endpoint", 250).replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.communication\.azure\.com$/i.test(endpoint)) throw new CreateError(400, "Use your Azure Communication Services resource endpoint.");
  const sender = required(input.sender, "SMS sender", 30);
  if (!/^\+[1-9]\d{7,14}$/.test(sender)) throw new CreateError(400, "Choose an SMS-enabled E.164 phone number owned by the Azure resource.");
  const topic = required(input.topic, "Azure resource ID", 500);
  if (!/^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.Communication\/communicationServices\/[^/]+$/i.test(topic)) throw new CreateError(400, "Enter the full Azure resource ID used as the Event Grid topic.");
  return { endpoint, sender, topic, eventGridVerified: false };
}
export function azureHeaders(method: string, url: URL, body: string, key: string, date = new Date().toUTCString()): Record<string, string> {
  const hash = createHash("sha256").update(body).digest("base64");
  const signature = createHmac("sha256", Buffer.from(key, "base64")).update(`${method}\n${url.pathname}${url.search}\n${date};${url.host};${hash}`).digest("base64");
  return { "Content-Type": "application/json", "x-ms-date": date, "x-ms-content-sha256": hash, Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}` };
}
export async function azureRequest(connection: CreateConnection, path: string, payload?: unknown): Promise<Record<string, unknown>> {
  const config = object(connection.configJson); const url = new URL(path, string(config.endpoint));
  const body = payload === undefined ? "" : JSON.stringify(payload); const method = payload === undefined ? "GET" : "POST";
  let response: Response;
  try { response = await fetch(url, { method, headers: azureHeaders(method, url, body, decryptCredential(connection.secret)), ...(body ? { body } : {}), signal: AbortSignal.timeout(20000), redirect: "error" }); }
  catch { throw new ProviderError("Azure request did not return an authoritative outcome. Reconcile before retrying.", method === "POST"); }
  if (!response.ok) throw new ProviderError(`Azure returned HTTP ${response.status}. Check resource credentials, sender readiness, and provider diagnostics.`, response.status >= 500 && method === "POST");
  try { return object(await response.json()); } catch { throw new ProviderError("Azure returned an incomplete response. Reconcile the provider outcome before retrying.", method === "POST"); }
}
export async function sendAzure(connection: CreateConnection, phone: string, message: string, deliveryId: string, firstSent: Date, attempt = 1) {
  const config = object(connection.configJson);
  const requestId = uuidv5(`oyamaCreate:${deliveryId}:${attempt}`, uuidv5.URL);
  const response = await azureRequest(connection, "/sms?api-version=2021-03-07", { from: config.sender, smsRecipients: [{ to: phone, repeatabilityRequestId: requestId, repeatabilityFirstSent: firstSent.toUTCString() }], message, smsSendOptions: { enableDeliveryReport: true, tag: deliveryId } });
  const result = object(Array.isArray(response.value) ? response.value[0] : null);
  if (result.successful === false) throw new ProviderError("Azure rejected the SMS. Review sender and recipient eligibility before retrying.", false);
  if (result.successful !== true || !string(result.messageId)) throw new ProviderError("Azure did not return an authoritative message acceptance result. Reconcile before retrying.", true);
  return string(result.messageId);
}
export function secureEqual(a: string, b: string): boolean {
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length > 0 && first.length === second.length && timingSafeEqual(first, second);
}
export async function graphRequest(token: string, version: string, path: string, payload?: Record<string, string>): Promise<Record<string, unknown>> {
  if (!/^v\d+\.\d+$/.test(version) || !/^\/?[a-z0-9_/?=,.%-]+$/i.test(path)) throw new CreateError(400, "Invalid Meta API request.");
  const url = `https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`;
  let response: Response;
  try { response = await fetch(url, { method: payload ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(payload ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, ...(payload ? { body: new URLSearchParams(payload).toString() } : {}), signal: AbortSignal.timeout(20000), redirect: "error" }); }
  catch { throw new ProviderError("Meta did not return an authoritative outcome. Reconcile the account before retrying.", !!payload); }
  if (!response.ok) throw new ProviderError(`Meta returned HTTP ${response.status}. Check account permissions and provider diagnostics.`, !!payload && response.status >= 500);
  try { return object(await response.json()); } catch { throw new ProviderError("Meta returned an incomplete response. Reconcile the provider outcome before retrying.", !!payload); }
}
export async function verifyConnection(connection: CreateConnection) {
  if (connection.provider === "AZURE_SMS") {
    const config = object(connection.configJson);
    const response = await azureRequest(connection, `/phoneNumbers/${encodeURIComponent(string(config.sender))}?api-version=2025-06-01`);
    const capabilities = object(response.capabilities);
    if (!/outbound/i.test(string(capabilities.sms))) throw new CreateError(422, "This Azure number does not have outbound SMS capability.");
    if (config.eventGridVerified !== true) throw new CreateError(422, "Credentials and sender verified. Complete the authenticated Event Grid subscription validation before enabling SMS.");
    return;
  }
  const config = object(connection.configJson); const secrets = object(JSON.parse(decryptCredential(connection.secret)));
  const response = await graphRequest(string(secrets.userToken), string(config.apiVersion), "me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D,tasks");
  const tokens: Record<string, string> = {}; const accounts: MetaAccount[] = [];
  for (const item of Array.isArray(response.data) ? response.data : []) {
    const page = object(item); const tasks = Array.isArray(page.tasks) ? page.tasks : [];
    if (!tasks.includes("CREATE_CONTENT") && !tasks.includes("MANAGE")) continue;
    const instagram = object(page.instagram_business_account);
    if (!/^\d+$/.test(string(page.id)) || !string(page.access_token)) continue;
    tokens[string(page.id)] = string(page.access_token);
    accounts.push({ id: string(page.id), name: string(page.name), instagramId: string(instagram.id), instagramName: string(instagram.username) });
  }
  if (!accounts.length) throw new CreateError(422, "No Facebook Pages with content publishing access were returned. Grant pages_show_list, pages_read_engagement, pages_manage_posts and the Instagram scopes for professional accounts.");
  const permissions = await graphRequest(string(secrets.userToken), string(config.apiVersion), "me/permissions");
  const granted = (Array.isArray(permissions.data) ? permissions.data : []).map(object).filter(row => row.status === "granted").map(row => row.permission);
  if (!["pages_show_list", "pages_read_engagement", "pages_manage_posts"].every(scope => granted.includes(scope))) throw new CreateError(422, "Meta has not granted the required Page publishing permissions.");
  await prisma.createConnection.update({ where: { id: connection.id }, data: { configJson: json({ ...config, accounts, instagramReady: ["instagram_basic", "instagram_content_publish"].every(scope => granted.includes(scope)) }), secret: encryptCredential(JSON.stringify({ ...secrets, pageTokens: tokens })) } });
}
export function metaAccount(connection: CreateConnection, accountId: string) {
  const config = object(connection.configJson); const secrets = object(JSON.parse(decryptCredential(connection.secret)));
  const account = (Array.isArray(config.accounts) ? config.accounts : []).map(object).find(item => item.id === accountId);
  const token = string(object(secrets.pageTokens)[accountId]);
  if (!account || !token) throw new CreateError(422, "Choose a verified Facebook Page from this organization's Meta connection.");
  return { account, token, version: string(config.apiVersion) };
}
