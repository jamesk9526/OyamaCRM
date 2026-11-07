import { Router } from "express";
import { prisma } from "./database.js";
import { audit, org } from "./security.js";
import { check, route, CareError } from "./http.js";
import { loadModulePolicies } from "./module-policy.js";
import { CARE_ROLES, MODULES, type ModulePolicy } from "./contracts/modules.js";

export const moduleRoutes = Router();
moduleRoutes.get("/modules", ...route("manage", async (req, res) => res.json({ definitions: MODULES, policies: await loadModulePolicies(org(req)) })));
moduleRoutes.put("/modules", ...route("manage", async (req, res) => {
  check(req.body.approve === true && Array.isArray(req.body.policies) && req.body.policies.length === MODULES.length, "Review the complete module configuration before saving.");
  const policies: ModulePolicy[] = MODULES.map(definition => {
    const matches = req.body.policies.filter((p: ModulePolicy) => p?.id === definition.id);
    check(matches.length === 1, "Provide each known module exactly once.");
    const p = matches[0];
    check(typeof p.enabled === "boolean" && Array.isArray(p.allowedRoles) && p.allowedRoles.every((r: unknown) => CARE_ROLES.includes(r as typeof CARE_ROLES[number])), "Choose valid care roles.");
    check(definition.id !== "core" || p.enabled, "Core must remain enabled.");
    return { id: definition.id, enabled: p.enabled, allowedRoles: [...new Set(p.allowedRoles)] as ModulePolicy["allowedRoles"] };
  });
  for (const definition of MODULES) if (policies.find(p => p.id === definition.id)!.enabled && definition.dependencies.some(id => !policies.find(p => p.id === id)!.enabled)) throw new CareError(409, "MODULE_DEPENDENCY", `Disable dependent modules before disabling a requirement of ${definition.name}.`);
  const previous = await loadModulePolicies(org(req));
  for (const policy of policies) await prisma.compassionConfiguration.upsert({ where: { organizationId_pluginKey: { organizationId: org(req), pluginKey: `module:${policy.id}` } }, create: { organizationId: org(req), pluginKey: `module:${policy.id}`, enabled: policy.enabled, config: { allowedRoles: policy.allowedRoles } }, update: { enabled: policy.enabled, config: { allowedRoles: policy.allowedRoles } } });
  for (const policy of policies) {
    const before = previous.find(p=>p.id===policy.id)!;
    if (before.enabled !== policy.enabled || before.allowedRoles.join(",") !== policy.allowedRoles.join(",")) await audit(req,"MODULE_ACCESS_CHANGED",policy.id,{beforeEnabled:before.enabled,enabled:policy.enabled,beforeRoles:before.allowedRoles.join(","),allowedRoles:policy.allowedRoles.join(",")});
  }
  await prisma.compassionReviewerSession.updateMany({ where: { organizationId: org(req), revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, "MODULE_POLICY_UPDATED", undefined, { modules: policies.length });
  res.json({ policies });
}));
