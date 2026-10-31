import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { isSchemaDriftError, migrationRequiredMessage } from "../lib/prisma-runtime-errors.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const authorSelect = { id: true, firstName: true, lastName: true, preferredName: true, jobTitle: true, avatarUrl: true } as const;
type Actor = { id: string; organizationId: string; firstName: string; preferredName: string | null };
function reject(status: number, message: string): never { throw Object.assign(new Error(message), { status }); }
function route(work: (req: Request, res: Response, actor: Actor) => Promise<unknown>) {
  return (req: Request, res: Response) => { void (async () => {
    const actor = await prisma.user.findFirst({ where: { id: req.user!.sub, organizationId: req.user!.orgId, active: true, role: "admin" }, select: { id: true, organizationId: true, firstName: true, preferredName: true } });
    if (!actor) reject(403, "An active administrator account in this organization is required.");
    await work(req, res, actor);
  })().catch(error => {
    const migration = isSchemaDriftError(error) || ["P2021", "P2022"].includes(error?.code);
    res.status(migration ? 503 : error?.status ?? 500).json({ error: { code: migration ? "MIGRATION_REQUIRED" : "COMMUNITY_ERROR", message: migration ? migrationRequiredMessage("Admin community") : error?.status ? error.message : "The community could not be updated. Please retry." } });
  }); };
}
function textBody(value: unknown, limit: number) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) reject(400, `Write a message between 1 and ${limit} characters.`);
  return value.trim();
}
function requestId(value: unknown, actor: Actor) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(value)) reject(400, "A valid request identifier is required.");
  return `${actor.id}:${value}`;
}
function pageNumber(value: unknown) {
  const page = Number(value ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) reject(400, "Invalid page.");
  return page;
}
async function visiblePost(id: string, actor: Actor) {
  const post = await prisma.communityPost.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
  if (!post) reject(404, "This conversation is no longer available.");
  return post;
}
const postInclude = (userId: string) => ({ author: { select: authorSelect }, _count: { select: { replies: { where: { deletedAt: null } }, reactions: true } }, reactions: { where: { userId }, select: { userId: true } } });

router.get("/members", route(async (req, res, actor) => {
  const page = pageNumber(req.query.page);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const items = await prisma.user.findMany({ where: { organizationId: actor.organizationId, active: true, role: "admin", ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { preferredName: { contains: search } }, { jobTitle: { contains: search } }] } : {}) },
    select: { ...authorSelect, bio: true, timezone: true, email: true, phone: true }, orderBy: [{ lastName: "asc" }, { id: "asc" }], skip: (page - 1) * 24, take: 25 });
  res.json({ items: items.slice(0, 24), hasMore: items.length > 24 });
}));
router.get("/posts", route(async (req, res, actor) => {
  const page = pageNumber(req.query.page);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const board = req.query.board === "true";
  const sort = req.query.sort ?? "new";
  if (!["new", "discussed", "liked"].includes(String(sort))) reject(400, "Choose a valid feed order.");
  const items = await prisma.communityPost.findMany({ where: { organizationId: actor.organizationId, deletedAt: null, ...(board ? { kind: { in: ["IDEA", "PROJECT", "QUESTION"] } } : {}), ...(search ? { OR: [{ body: { contains: search } }, { title: { contains: search } }] } : {}), ...(req.query.mine === "true" ? { authorId: actor.id } : {}) }, include: postInclude(actor.id), orderBy: [...(sort === "discussed" ? [{ replies: { _count: "desc" as const } }] : sort === "liked" ? [{ reactions: { _count: "desc" as const } }] : []), { createdAt: "desc" }, { id: "desc" }], take: 21, skip: (page - 1) * 20 });
  res.json({ items: items.slice(0, 20), hasMore: items.length > 20 });
}));
router.get("/posts/:id", route(async (req, res, actor) => {
  await visiblePost(String(req.params.id), actor);
  res.json(await prisma.communityPost.findUnique({ where: { id: String(req.params.id) }, include: postInclude(actor.id) }));
}));
router.post("/posts", route(async (req, res, actor) => {
  const body = textBody(req.body?.body, 3000), key = requestId(req.body?.requestId, actor);
  const kind = req.body?.kind ?? "UPDATE";
  if (!["UPDATE", "IDEA", "PROJECT", "QUESTION"].includes(kind)) reject(400, "Choose an entry type.");
  const title = kind === "UPDATE" ? null : textBody(req.body?.title, 160);
  const data = { organizationId: actor.organizationId, authorId: actor.id, body, requestId: key, kind, title };
  try { const post = await prisma.communityPost.create({ data }); res.status(201).json({ id: post.id }); }
  catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.communityPost.findFirst({ where: { requestId: key, organizationId: actor.organizationId, authorId: actor.id, body, kind, title, deletedAt: null } });
    if (!existing) reject(409, "This request was already used. Refresh before posting again.");
    res.json({ id: existing.id });
  }
}));
router.put("/posts/:id", route(async (req, res, actor) => {
  const body = textBody(req.body?.body, 3000);
  const title = req.body?.title === undefined ? undefined : req.body.title === null ? null : textBody(req.body.title, 160);
  const updatedAt = new Date(req.body?.updatedAt);
  if (!Number.isFinite(updatedAt.getTime())) reject(400, "Reload this post before editing.");
  const result = await prisma.communityPost.updateMany({ where: { id: String(req.params.id), organizationId: actor.organizationId, authorId: actor.id, deletedAt: null, updatedAt }, data: { body, ...(title !== undefined ? { title } : {}) } });
  if (!result.count) reject(409, "This post changed or is no longer editable. Refresh before trying again.");
  res.json({ saved: true });
}));
router.put("/posts/:id/stage", route(async (req, res, actor) => {
  const stage = req.body?.stage;
  if (!["OPEN", "PLANNED", "IN_PROGRESS", "DONE"].includes(stage)) reject(400, "Choose a valid stage.");
  const result = await prisma.communityPost.updateMany({ where: { id: String(req.params.id), organizationId: actor.organizationId, deletedAt: null, kind: { in: ["IDEA", "PROJECT", "QUESTION"] } }, data: { stage } });
  if (!result.count) reject(404, "Board entry unavailable.");
  res.json({ saved: true });
}));
router.delete("/posts/:id", route(async (req, res, actor) => {
  await prisma.$transaction(async tx => {
    const result = await tx.communityPost.updateMany({ where: { id: String(req.params.id), organizationId: actor.organizationId, authorId: actor.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) reject(404, "Your post could not be found.");
    await tx.notification.updateMany({ where: { organizationId: actor.organizationId, sourceType: "community-reply", href: `/community?post=${encodeURIComponent(String(req.params.id))}` }, data: { archivedAt: new Date() } });
  });
  res.json({ deleted: true });
}));
router.get("/posts/:id/replies", route(async (req, res, actor) => {
  const post = await visiblePost(String(req.params.id), actor), page = pageNumber(req.query.page);
  const items = await prisma.communityReply.findMany({ where: { postId: post.id, deletedAt: null }, include: { author: { select: authorSelect } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 21 });
  res.json({ items: items.slice(0, 20), hasMore: items.length > 20 });
}));
router.post("/posts/:id/replies", route(async (req, res, actor) => {
  const post = await visiblePost(String(req.params.id), actor);
  const body = textBody(req.body?.body, 1200), key = requestId(req.body?.requestId, actor);
  try {
    const reply = await prisma.$transaction(async tx => {
      // Serialize with post removal so a deleted thread cannot gain a new reply/alert.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM CommunityPost WHERE id = ${post.id} AND organizationId = ${actor.organizationId} AND deletedAt IS NULL FOR UPDATE`;
      if (!locked.length) reject(404, "This conversation is no longer available.");
      const reply = await tx.communityReply.create({ data: { postId: post.id, authorId: actor.id, requestId: key, body } });
      if (post.authorId !== actor.id && await tx.user.findFirst({ where: { id: post.authorId, organizationId: actor.organizationId, active: true, role: "admin" }, select: { id: true } })) {
        await tx.notification.create({ data: { organizationId: actor.organizationId, userId: post.authorId, module: "community", sourceType: "community-reply", sourceId: reply.id, title: "New reply in Admin community", message: `${actor.preferredName || actor.firstName} replied to your post.`, href: `/community?post=${encodeURIComponent(post.id)}`, actionLabel: "View conversation", severity: "LOW" } });
      }
      return reply;
    });
    res.status(201).json({ id: reply.id });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.communityReply.findFirst({ where: { requestId: key, postId: post.id, authorId: actor.id, body, deletedAt: null } });
    if (!existing) reject(409, "This request was already used. Refresh before replying again.");
    res.json({ id: existing.id });
  }
}));
router.delete("/posts/:id/replies/:replyId", route(async (req, res, actor) => {
  const post = await visiblePost(String(req.params.id), actor);
  await prisma.$transaction(async tx => {
    const result = await tx.communityReply.updateMany({ where: { id: String(req.params.replyId), postId: post.id, authorId: actor.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) reject(404, "Your reply could not be found.");
    await tx.notification.updateMany({ where: { organizationId: actor.organizationId, sourceType: "community-reply", sourceId: String(req.params.replyId) }, data: { archivedAt: new Date() } });
  }); res.json({ deleted: true });
}));
router.put("/posts/:id/reaction", route(async (req, res, actor) => {
  const post = await visiblePost(String(req.params.id), actor);
  if (typeof req.body?.liked !== "boolean") reject(400, "Choose whether to like this post.");
  if (req.body.liked) await prisma.communityReaction.upsert({ where: { postId_userId: { postId: post.id, userId: actor.id } }, create: { postId: post.id, userId: actor.id }, update: {} });
  else await prisma.communityReaction.deleteMany({ where: { postId: post.id, userId: actor.id } });
  res.json({ saved: true });
}));
export default router;
