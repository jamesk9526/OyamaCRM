import { prisma } from "../../lib/prisma.js";
import { CreateError, object, string } from "../domain.js";

/** Resolves campaign attribution without exposing the recipient attached to a response code. */
export async function responseAttribution(org: string, token: string, value: unknown): Promise<Record<string, string>> {
  const code = string(value).trim();
  if (!code) return {};
  const invalid = () => new CreateError(400, "This campaign response link is unavailable. Open the current giving page to continue.");
  if (!/^[a-zA-Z0-9_-]{24}$/.test(code)) throw invalid();
  const response = await prisma.createResponseCode.findFirst({ where: { organizationId: org, code } });
  if (!response) throw invalid();
  const payload = object(response.payloadJson);
  let destination: URL;
  try { destination = new URL(string(payload.givingUrl), "https://studio.invalid"); } catch { throw invalid(); }
  if (destination.pathname !== `/give/${token}`) throw invalid();
  const release = await prisma.createRelease.findFirst({ where: { id: response.releaseId, organizationId: org, status: { in: ["RELEASED", "SUPERSEDED"] } } });
  if (!release) throw invalid();
  const campaign = object(object(release.snapshotJson).campaign), financialCampaignId = string(campaign.fundraisingCampaignId);
  if (financialCampaignId && !await prisma.campaign.findFirst({ where: { id: financialCampaignId, organizationId: org } })) throw invalid();
  return { createCampaignId: release.campaignId, createReleaseId: release.id, createContentId: response.contentId, createResponseCode: code, ...(financialCampaignId ? { campaignId: financialCampaignId } : {}) };
}
