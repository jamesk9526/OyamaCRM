import { importCommunication } from "./import-service.js";
import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { assertCampaign, can, demandChannels } from "./access.js";
import { route, param } from "./http.js";
import { CreateError, string, type Channel } from "./domain.js";
import { emailRecordAccessible, reusableEmailRecord } from "./legacy.js";
const router = Router();
router.get("/legacy", route(async (req, res, org, actor) => {
  const limit=Math.min(100,Math.max(1,Number(req.query.limit)||40)),after=string(req.query.after),q=string(req.query.q).slice(0,191),channel=string(req.query.channel);
  const permissions={email:await can(req,"view:communications"),letter:await can(req,"letters.view")};
  const input={where:{organizationId:org,...(after?{id:{gt:after}}:{}),...(q?{name:{contains:q}}:{})},orderBy:{id:"asc" as const},take:limit+1};
  const emails=permissions.email&&channel!=="LETTER"?await prisma.emailCampaign.findMany(input):[];
  const letters=permissions.letter&&channel!=="EMAIL"?await prisma.letterTemplate.findMany({...input,where:{...input.where,crmScope:"DONOR"}}):[];
  const candidates=[...emails.filter(email=>emailRecordAccessible(email,actor,req.user!.role)).map(email=>({id:email.id,channel:"EMAIL",name:email.name,status:email.status,historical:email.status!=="DRAFT"||email.totalRecipients>0||!!email.sentAt||!!email.scheduledAt,isTemplate:reusableEmailRecord(email),updatedAt:email.updatedAt})),...letters.map(letter=>({id:letter.id,channel:"LETTER",name:letter.name,status:letter.status,historical:false,isTemplate:true,updatedAt:letter.updatedAt}))].sort((a,b)=>a.id.localeCompare(b.id));
  const page=candidates.slice(0,limit),bindings=await prisma.createVariant.findMany({where:{organizationId:org,legacyId:{in:page.map(item=>item.id)}},select:{channel:true,legacyId:true,content:{select:{campaignId:true}}}});
  const hasMore=candidates.length>limit||emails.length>limit||letters.length>limit;
  res.json({items:page.map(item=>({...item,campaignId:bindings.find(binding=>binding.channel===item.channel&&binding.legacyId===item.id)?.content.campaignId||null})),hasMore,nextCursor:hasMore?(page.at(-1)?.id||emails.at(-1)?.id||letters.at(-1)?.id):null,limited:false});
}));
router.get("/legacy/:channel/:id", route(async (req, res, org) => {
  const channel = param(req, "channel") as Channel; await demandChannels(req, [channel]);
  if (!["EMAIL", "LETTER"].includes(channel)) throw new CreateError(400, "Unknown legacy channel.");
  const binding = await prisma.createVariant.findFirst({ where: { organizationId: org, channel, legacyId: param(req) }, select: { contentId: true, content: { select: { campaignId: true } } } });
  if (binding) await assertCampaign(req, binding.content.campaignId);
  res.json(binding ? { campaignId: binding.content.campaignId, contentId: binding.contentId, channel } : { campaignId: null, channel, legacyId: param(req) });
}));
export async function importSource(req: Request, org: string, actor: string, channel: Channel, legacyId: string) {
  if (!["EMAIL", "LETTER"].includes(channel) || !legacyId) throw new CreateError(400,"Choose an existing email or donor letter.");
  return importCommunication(req,org,actor,channel as "EMAIL"|"LETTER",legacyId);
}
router.post("/legacy/import", route(async (req, res, org, actor) => {
  res.status(201).json(await importSource(req, org, actor, string(req.body.channel) as Channel, string(req.body.legacyId)));
}));
export default router;
