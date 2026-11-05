import type { SurveyAudience } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { hasCareCapability, type CareCapability } from "../compassion/security.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { SurveyError } from "./definition.js";

const abilities = ["view", "edit", "publish", "send", "responses", "export"] as const;
export type Ability = typeof abilities[number];
const careAbility: Record<Ability, CareCapability> = {
  view: "casework", edit: "casework", publish: "manage", send: "messages", responses: "casework", export: "export",
};

export async function surveyAccess(organizationId: string, actorId: string, lane: SurveyAudience) {
  const [user, care, settings] = await Promise.all([
    db.user.findFirst({ where: { organizationId, id: actorId, active: true }, select: { role: true, permissions: true } }),
    lane === "CLIENT" ? db.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: actorId } } }) : null,
    db.organizationSettings.findUnique({ where: { organizationId }, select: { donorWorkspaceEnabled: true, timezone: true } }),
  ]);
  const donor = lane === "DONOR" && user && user.role !== "compassion_user" && settings?.donorWorkspaceEnabled !== false
    ? abilities.filter(ability => {
      const key = `surveys.${ability}` as PermissionKey;
      return user.permissions.find(permission => permission.permission === key)?.granted ?? hasDefaultPermission(user.role, key);
    }) : [];
  const client = user && care?.active && hasCareCapability(care.role, "casework")
    ? abilities.filter(ability => hasCareCapability(care.role, careAbility[ability])) : [];
  return { DONOR: donor, CLIENT: client, timezone: settings?.timezone ?? "America/Chicago" };
}

export type SurveyAccess = Awaited<ReturnType<typeof surveyAccess>>;

export function requireSurveyAccess(access: SurveyAccess, audience: SurveyAudience, ability: Ability) {
  if (!access[audience].includes("view") || !access[audience].includes(ability)) {
    throw new SurveyError(403, "FORBIDDEN", "Your workspace permissions do not allow this survey action.");
  }
}
