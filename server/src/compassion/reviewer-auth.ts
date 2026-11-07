import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { generateSecret, generateURI, verify } from "otplib";
import { NodeCryptoPlugin } from "@otplib/plugin-crypto-node";
import QRCode from "qrcode";
import { comparePassword } from "../lib/auth.js";
import { atomic, prisma } from "./database.js";
import { accessToken, audit, digest, seal, unseal } from "./security.js";
import { effectiveModules } from "./contracts/modules.js";
import { loadModulePolicies } from "./module-policy.js";
import { CareError } from "./http.js";

const crypto = new NodeCryptoPlugin();
export const REVIEW_COOKIE = "compassion_physician";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/compassion/physician-review" };
const minutes = (n: number) => n * 60000;
const csrfForToken = (token: string) => createHmac("sha256",Buffer.from(process.env.COMPASSION_ENCRYPTION_KEY!,"hex")).update(`compassion-review-csrf:${token}`).digest("hex");
export const reviewerSafe = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { if (error instanceof CareError) res.status(error.status).json({ error: { code: error.code, message: error.message } }); else next(error); }
};
function identify(req: Request, user: { id: string; email: string; organizationId: string }) { req.user = { sub: user.id, email: user.email, orgId: user.organizationId, role: "compassion_user" }; }
async function account(userId: string, organizationId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId, active: true, role: "compassion_user" } });
  const membership = await prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  const modules = effectiveModules(await loadModulePolicies(organizationId), "ULTRASOUND_REVIEWER");
  if (!user || !membership?.active || membership.role !== "ULTRASOUND_REVIEWER" || !modules["physician-review"]) throw new CareError(403, "REVIEW_ACCESS_REQUIRED", "An active ultrasound reviewer account and enabled physician portal are required.");
  return { user, membership };
}
async function acceptTotp(organizationId: string, userId: string, token: unknown) {
  const row = await prisma.compassionReviewerAuthenticator.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!row || typeof token !== "string" || !/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret: unseal(row.encryptedSecret, `${organizationId}:${userId}:totp`), token, crypto, epochTolerance: 30 });
  if (!result.valid || !("timeStep" in result) || typeof result.timeStep !== "number" || BigInt(result.timeStep) <= row.lastStep) return false;
  const changed = await prisma.compassionReviewerAuthenticator.updateMany({ where: { id: row.id, lastStep: row.lastStep }, data: { lastStep: BigInt(result.timeStep), verifiedAt: row.verifiedAt ?? new Date() } });
  return changed.count === 1;
}
async function issueSession(req: Request, res: Response, userId: string, organizationId: string) {
  const { user, membership } = await account(userId, organizationId);
  const token = accessToken(); const csrf = csrfForToken(token); const now = new Date();
  await prisma.compassionReviewerSession.create({ data: { organizationId, userId, tokenHash: digest(token), csrfHash: digest(csrf), accountVersion: user.updatedAt, membershipVersion: membership.updatedAt, mfaAt: now, lastActivityAt: now, expiresAt: new Date(Date.now() + minutes(480)) } });
  identify(req, user); await audit(req, "REVIEWER_SIGNED_IN", userId);
  res.cookie(REVIEW_COOKIE, token, cookieOptions);
  return { csrf, user: { firstName: user.firstName, lastName: user.lastName }, expiresAt: new Date(Date.now() + minutes(480)).toISOString() };
}

export const reviewerAuthRoutes = Router();
reviewerAuthRoutes.use((req,res,next)=>{if(process.env.NODE_ENV === "production" && !req.secure){res.status(426).json({error:{code:"HTTPS_REQUIRED",message:"Use the secure HTTPS physician login."}});return;}next();});
reviewerAuthRoutes.use(["/login", "/verify"], rateLimit({ windowMs: minutes(15), limit: 40, standardHeaders: "draft-7", legacyHeaders: false }));
reviewerAuthRoutes.post("/login", reviewerSafe(async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || email.length > 254 || !password || password.length > 512) throw new CareError(401, "INVALID_CREDENTIALS", "Unable to sign in with these credentials.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || user.role !== "compassion_user") throw new CareError(401, "INVALID_CREDENTIALS", "Unable to sign in with these credentials.");
  const validPassword = !!user.passwordHash && await comparePassword(password,user.passwordHash);
  const result = await atomic(user.organizationId, async () => {
    const attempts = await prisma.compassionReviewerChallenge.count({ where: { organizationId: user.organizationId, userId: user.id, createdAt: { gt: new Date(Date.now() - minutes(15)) } } });
    if (attempts >= 10) return { blocked: true };
    const token = accessToken();
    const valid = validPassword;
    await prisma.compassionReviewerChallenge.create({ data: { organizationId: user.organizationId, userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + minutes(5)), attempts: valid ? 0 : 5, usedAt: valid ? null : new Date() } });
    identify(req, user); await audit(req, valid ? "REVIEWER_PASSWORD_VERIFIED" : "REVIEWER_LOGIN_FAILED", user.id);
    return valid ? { token } : { invalid: true };
  });
  if (!("token" in result) || !result.token) throw new CareError(401, "INVALID_CREDENTIALS", "Unable to sign in. Check your credentials or wait before trying again.");
  await account(user.id, user.organizationId);
  let authenticator = await prisma.compassionReviewerAuthenticator.findUnique({ where: { organizationId_userId: { organizationId: user.organizationId, userId: user.id } } });
  if (!authenticator) authenticator = await atomic(user.organizationId, async () => {
    const existing = await prisma.compassionReviewerAuthenticator.findUnique({ where: { organizationId_userId: { organizationId: user.organizationId, userId: user.id } } });
    return existing ?? prisma.compassionReviewerAuthenticator.create({ data: { organizationId: user.organizationId, userId: user.id, encryptedSecret: seal(generateSecret({ crypto }), `${user.organizationId}:${user.id}:totp`), recoveryHashes: [] } });
  });
  const enroll = !authenticator.verifiedAt;
  const uri = enroll ? generateURI({ issuer: "Compassion Physician Review", label: user.email, secret: unseal(authenticator.encryptedSecret, `${user.organizationId}:${user.id}:totp`) }) : undefined;
  res.json({ challenge: result.token, enroll, ...(uri ? { qr: await QRCode.toDataURL(uri), setupKey: unseal(authenticator.encryptedSecret, `${user.organizationId}:${user.id}:totp`) } : {}) });
}));
reviewerAuthRoutes.post("/verify", reviewerSafe(async (req, res) => {
  const hash = typeof req.body?.challenge === "string" ? digest(req.body.challenge) : "";
  const challenge = await prisma.compassionReviewerChallenge.findUnique({ where: { tokenHash: hash } });
  if (!challenge) throw new CareError(401, "INVALID_CHALLENGE", "Sign in again to obtain a new verification request.");
  const result = await atomic(challenge.organizationId, async () => {
    const current = await prisma.compassionReviewerChallenge.findUnique({ where: { tokenHash: hash } });
    if (!current || current.usedAt || current.attempts >= 5 || current.expiresAt <= new Date()) return null;
    const { user } = await account(current.userId, current.organizationId); identify(req, user);
    await prisma.compassionReviewerChallenge.update({ where: { id: current.id }, data: { attempts: current.attempts + 1 } });
    const before = await prisma.compassionReviewerAuthenticator.findUnique({ where: { organizationId_userId: { organizationId: current.organizationId, userId: current.userId } } });
    const recovery = typeof req.body.recoveryCode === "string" ? digest(req.body.recoveryCode.trim()) : "";
    const hashes = Array.isArray(before?.recoveryHashes) ? before.recoveryHashes as string[] : [];
    if (recovery && hashes.includes(recovery)) {
      await prisma.compassionReviewerAuthenticator.deleteMany({ where: { id: before!.id } });
      await prisma.compassionReviewerSession.updateMany({ where: { organizationId: current.organizationId, userId: current.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await prisma.compassionReviewerChallenge.updateMany({ where: { organizationId: current.organizationId, userId: current.userId, usedAt: null }, data: { usedAt: new Date() } });
      await audit(req, "REVIEWER_MFA_RECOVERED", current.userId);
      return { recovery: true };
    }
    if (!await acceptTotp(current.organizationId, current.userId, req.body.code)) { await audit(req, "REVIEWER_MFA_FAILED", current.userId); return null; }
    await prisma.compassionReviewerChallenge.update({ where: { id: current.id }, data: { usedAt: new Date() } });
    let recoveryCodes: string[] | undefined;
    if (!before?.verifiedAt) {
      recoveryCodes = Array.from({ length: 8 }, () => accessToken());
      await prisma.compassionReviewerAuthenticator.update({ where: { id: before!.id }, data: { recoveryHashes: recoveryCodes.map(digest) } });
      await audit(req, "REVIEWER_MFA_ENROLLED", current.userId);
    }
    return { ...await issueSession(req, res, current.userId, current.organizationId), ...(recoveryCodes ? { recoveryCodes } : {}) };
  });
  if (!result) throw new CareError(401, "INVALID_CODE", "Verification failed. Use a new code or sign in again.");
  res.json(result);
}));

export async function authenticateReviewer(req: Request, res: Response) {
  const cookie = req.headers.cookie?.split(";").map(p => p.trim()).find(p => p.startsWith(`${REVIEW_COOKIE}=`))?.slice(REVIEW_COOKIE.length + 1);
  const session = cookie ? await prisma.compassionReviewerSession.findUnique({ where: { tokenHash: digest(cookie) } }) : null;
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.lastActivityAt.getTime() <= Date.now() - minutes(15)) throw new CareError(401, "REVIEW_SESSION_EXPIRED", "Your physician session expired. Sign in again.");
  const { user, membership } = await account(session.userId, session.organizationId);
  if (user.updatedAt.getTime() !== session.accountVersion.getTime() || membership.updatedAt.getTime() !== session.membershipVersion.getTime()) throw new CareError(401, "REVIEW_SESSION_REVOKED", "Your account changed. Sign in again.");
  if (!["GET", "HEAD"].includes(req.method)) {
    if (typeof req.headers["x-review-csrf"] !== "string" || session.csrfHash.length !== 64 || !timingSafeEqual(Buffer.from(digest(req.headers["x-review-csrf"])),Buffer.from(session.csrfHash))) throw new CareError(403, "CSRF_REQUIRED", "Reload the physician workspace before continuing.");
  }
  identify(req, user); res.locals.reviewerSession = session; res.locals.reviewerCsrf = csrfForToken(cookie!);
  res.locals.reviewerUser = { firstName: user.firstName, lastName: user.lastName };
}
export const reviewerMiddleware: RequestHandler = (req, res, next) => {
  void authenticateReviewer(req, res).then(() => next()).catch(error => {
    if (error instanceof CareError) res.status(error.status).json({ error: { code: error.code, message: error.message } }); else next(error);
  });
};
export async function touchReviewer(res: Response) { await prisma.compassionReviewerSession.update({ where: { id: res.locals.reviewerSession.id }, data: { lastActivityAt: new Date() } }); }
export async function freshReviewerMfa(req: Request, res: Response): Promise<boolean> {
  const session = res.locals.reviewerSession;
  if (session.mfaAt.getTime() > Date.now() - minutes(5)) return true;
  if (!await acceptTotp(session.organizationId, session.userId, req.body.code)) {
    const failures = (session.mfaFailures || 0) + 1;
    await prisma.compassionReviewerSession.update({ where: { id: session.id }, data: { mfaFailures: failures, ...(failures >= 5 ? { revokedAt: new Date() } : {}) } });
    await audit(req, "REVIEWER_STEP_UP_FAILED", session.userId); return false;
  }
  await prisma.compassionReviewerSession.update({ where: { id: session.id }, data: { mfaAt: new Date(), mfaFailures: 0 } });
  return true;
}
export function clearReviewer(res: Response) { res.clearCookie(REVIEW_COOKIE, cookieOptions); }
