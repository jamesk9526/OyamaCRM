import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { parseSiteEmbedsConfig, SITE_EMBEDS_PLUGIN_KEY } from "../../services/site-embeds.js";

import { demand } from "../access.js";
import { route, param } from "../http.js";
import { CreateError, string } from "../domain.js";
import { brandForDesign, brandReviewToken, readBrand } from "./brand-service.js";
import { profileIdentity } from "./brand.js";
const router = Router();
type PublicChannel = "WEB"|"GIVING"|"EVENT"|"WIDGET";
export async function brandOutputs(org: string) {
  const [setting, events, publications, bindings] = await Promise.all([
    prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: SITE_EMBEDS_PLUGIN_KEY } } }),
    prisma.event.findMany({ where: { organizationId: org }, select: { id: true, name: true }, take: 300, orderBy: { name: "asc" } }),
    prisma.createPublication.findMany({ where: { organizationId: org, active: true }, select: { id: true, slug: true, campaignId: true }, take: 300 }),
    prisma.createBrandBinding.findMany({ where: { organizationId: org }, take: 1000 }),
  ]);
  const sites = setting ? parseSiteEmbedsConfig(setting.config).sites : [];
  const outputs: Array<{channel:PublicChannel;id:string;name:string;href:string;binding?:typeof bindings[number]}> = [];
  for (const site of sites) {
    outputs.push({channel:"WIDGET",id:site.id,name:`${site.name} widgets`,href:`/settings/site-embeds?siteId=${encodeURIComponent(site.id)}`});
    if (site.widgets.donation_widget.hostedPageEnabled) outputs.push({channel:"GIVING",id:site.id,name:`${site.name} giving page`,href:`/give/${site.embedToken}`});
  }
  outputs.push(...events.map(event=>({channel:"EVENT" as const,id:event.id,name:event.name,href:`/events/${event.id}/event-page`})), ...publications.map(page=>({channel:"WEB" as const,id:page.id,name:page.slug,href:`/campaign-pages/${page.slug}`})));
  return outputs.map(output=>({...output,binding:bindings.find(binding=>binding.channel===output.channel&&binding.resourceId===output.id)}));
}
router.get("/brand/outputs", route(async (req,res,org)=>{await demand(req,"view:communications");res.json(await brandOutputs(org));}));
router.get("/brand/outputs/:channel/:id/review", route(async (req,res,org)=>{
  await demand(req,"create.brand.publish");const channel=string(req.params.channel),id=param(req);
  const output=(await brandOutputs(org)).find(item=>item.channel===channel&&item.id===id);if(!output)throw new CreateError(404,"Output not found in your organization.");
  const state=await readBrand(org);if(!state.published)throw new CreateError(422,"Publish a brand revision first.");
  const settings=await prisma.organizationSettings.findUnique({where:{organizationId:org}}),prior=output.binding?.brandRevisionId||settings?.createBrandPublicBaselineId;
  const before=prior?profileIdentity(await brandForDesign(org,prior),output.channel,id):{},after=profileIdentity(state.published.document,output.channel,id);
  res.json({output,publishedId:state.published.id,bindingRevision:output.binding?.revision||0,before,after,reviewToken:brandReviewToken(org,output.binding?.revision||0,state.published.id,[channel,id,before,after])});
}));
router.put("/brand/outputs/:channel/:id", route(async(req,res,org,actor)=>{
  await demand(req,"create.brand.publish");const channel=string(req.params.channel),id=param(req),state=await readBrand(org);
  const output=(await brandOutputs(org)).find(item=>item.channel===channel&&item.id===id);if(!output)throw new CreateError(404,"Output not found in your organization.");
  if(!state.published||state.published.id!==req.body.publishedId||req.body.confirm!==true)throw new CreateError(409,"Review the latest published brand before updating this public output.");
  const settings=await prisma.organizationSettings.findUnique({where:{organizationId:org}}),prior=output.binding?.brandRevisionId||settings?.createBrandPublicBaselineId;
  const before=prior?profileIdentity(await brandForDesign(org,prior),output.channel,id):{},after=profileIdentity(state.published.document,output.channel,id),revision=output.binding?.revision||0;
  if(req.body.bindingRevision!==revision||req.body.reviewToken!==brandReviewToken(org,revision,state.published.id,[channel,id,before,after]))throw new CreateError(409,"The output changed. Preview its brand update again.");
  const publishedId=state.published.id;
  await prisma.$transaction(async tx=>{
    if(output.binding){const changed=await tx.createBrandBinding.updateMany({where:{id:output.binding.id,organizationId:org,revision},data:{brandRevisionId:publishedId,revision:{increment:1},updatedBy:actor}});if(!changed.count)throw new CreateError(409,"The output changed in another session.");}
    else await tx.createBrandBinding.create({data:{organizationId:org,channel,resourceId:id,brandRevisionId:publishedId,updatedBy:actor}});
    await tx.auditLog.create({data:{organizationId:org,userId:actor,action:"CREATE_PUBLIC_BRAND_UPDATED",entity:"CreateBrandBinding",entityId:id,metadata:{channel,brandRevisionId:publishedId}}});
  });res.json({updated:true,brandRevisionId:publishedId});
}));
export default router;
