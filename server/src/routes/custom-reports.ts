import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validateCustomReport, transformCustomReport } from "../services/custom-donor-report.js";
import { buildDonorLibraryReport, isDonorLibraryReportKey, parseDonorLibraryReportOptions } from "../services/donor-report-library.js";
const router=Router(); router.use(requireAuth,requirePermission("view:reports"));router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});
function route(work:(req:Request,res:Response)=>Promise<unknown>){return(req:Request,res:Response)=>{void work(req,res).catch(error=>res.status(error?.status??500).json({error:{message:error?.status?error.message:"Custom reports unavailable. Please retry."}}));};}
function scope(req:Request){if(!req.user?.orgId)throw Object.assign(new Error("Organization required."),{status:403});return {organizationId:req.user.orgId,pluginKey:`custom-report:${req.user.sub}:`};}
router.get("/",route(async(req,res)=>{const s=scope(req); const items=await prisma.pluginSetting.findMany({where:{organizationId:s.organizationId,pluginKey:{startsWith:s.pluginKey}},orderBy:{updatedAt:"desc"},take:100,select:{id:true,config:true,updatedAt:true}});res.json({items});}));
router.post("/",route(async(req,res)=>{const s=scope(req), definition=validateCustomReport(req.body);const count=await prisma.pluginSetting.count({where:{organizationId:s.organizationId,pluginKey:{startsWith:s.pluginKey}}});if(count>=100)throw Object.assign(new Error("Limit of 100 saved reports reached. Remove a saved report first."),{status:400});const item=await prisma.pluginSetting.create({data:{organizationId:s.organizationId,pluginKey:s.pluginKey+randomUUID(),enabled:true,config:{...definition}}});res.status(201).json({id:item.id});}));
router.delete("/:id",route(async(req,res)=>{const s=scope(req);const result=await prisma.pluginSetting.deleteMany({where:{id:String(req.params.id),organizationId:s.organizationId,pluginKey:{startsWith:s.pluginKey}}});if(!result.count)throw Object.assign(new Error("Saved report not found."),{status:404});res.json({deleted:true});}));
router.post("/run",route(async(req,res)=>{const s=scope(req),definition=validateCustomReport(req.body);if(!isDonorLibraryReportKey(definition.source))return;const options=parseDonorLibraryReportOptions(definition.source,{from:definition.from,through:definition.through},new Date());const report=await buildDonorLibraryReport(s.organizationId,definition.source,options);res.json(transformCustomReport(report,definition));}));
export default router;
