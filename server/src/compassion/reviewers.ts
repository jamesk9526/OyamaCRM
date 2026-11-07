import { Router } from "express";
import { hashPassword } from "../lib/auth.js";
import { prisma } from "./database.js";
import { audit, org } from "./security.js";
import { check, route, text } from "./http.js";

export const reviewerAdminRoutes = Router();
reviewerAdminRoutes.get("/reviewers", ...route("manage", async (req, res) => {
  const memberships = await prisma.compassionMembership.findMany({ where: { organizationId: org(req), role: "ULTRASOUND_REVIEWER" } });
  const users = await prisma.user.findMany({ where: { organizationId: org(req), id: { in: memberships.map(row => row.userId) } }, select: { id: true, firstName: true, lastName: true, email: true, active: true } });
  const authenticators = await prisma.compassionReviewerAuthenticator.findMany({ where: { organizationId: org(req) }, select: { userId: true, verifiedAt: true } });
  res.json(users.map(user => ({ ...user, active: user.active && memberships.find(m => m.userId === user.id)!.active, enrolled: !!authenticators.find(a => a.userId === user.id)?.verifiedAt })));
}));
reviewerAdminRoutes.post("/reviewers", ...route("manage", async (req, res) => {
  check(req.body.approve === true && req.body.credentialsVerified === true, "Verify the physician’s identity and credentials, then review this account grant.");
  const email = text(req.body.email, 254).toLowerCase(); check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Enter a valid email address.");
  const password = req.body.password; check(typeof password === "string" && password.length >= 15 && Buffer.byteLength(password,"utf8") <= 72, "Use an initial password of at least 15 characters and at most 72 UTF-8 bytes.");
  check(!await prisma.user.findUnique({ where: { email } }), "This email already has an account. Use a separate dedicated physician-review identity.");
  const user = await prisma.user.create({ data: { organizationId: org(req), email, firstName: text(req.body.firstName, 100), lastName: text(req.body.lastName, 100), role: "compassion_user", passwordHash: await hashPassword(password), active: true } });
  await prisma.compassionMembership.create({ data: { organizationId: org(req), userId: user.id, role: "ULTRASOUND_REVIEWER", active: true } });
  await audit(req, "REVIEWER_PROVISIONED", user.id, { credentialsVerified: true }); res.status(201).json({ id: user.id });
}));
reviewerAdminRoutes.post("/reviewers/:id/reset", ...route("manage", async (req, res) => {
  check(req.body.approve === true && req.body.identityVerified === true, "Verify physician identity before resetting the authenticator.");
  const userId = String(req.params.id);
  check(await prisma.compassionMembership.findFirst({ where: { organizationId: org(req), userId, role: "ULTRASOUND_REVIEWER" } }), "Reviewer not found.");
  await prisma.compassionReviewerAuthenticator.deleteMany({ where: { organizationId: org(req), userId } });
  await prisma.compassionReviewerSession.updateMany({ where: { organizationId: org(req), userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.compassionReviewerChallenge.updateMany({ where: { organizationId: org(req), userId, usedAt: null }, data: { usedAt: new Date() } });
  await audit(req, "REVIEWER_MFA_RESET", userId); res.json({ reset: true });
}));
