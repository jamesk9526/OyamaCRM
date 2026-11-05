/** Explicitly scoped inventory/backfill using the same service as automatic imports. */
import "dotenv/config";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ensureImport, inventory, processImports } from "./import-service.js";
const args=process.argv.slice(2);
const option=(key:string)=>args.includes(key)?args[args.indexOf(key)+1]:undefined;
async function main(){
 const organizationId=option("--organization"),userId=option("--user");
 if(!organizationId||!userId)throw new Error("Usage: pnpm create:backfill --organization ORG --user ADMIN [--apply]. Default is read-only inventory.");
 const actor=await prisma.user.findFirst({where:{id:userId,organizationId,role:"admin",active:true}});
 if(!actor)throw new Error("Choose an active administrator in the selected organization.");
 console.log(JSON.stringify({mode:"READ_ONLY_INVENTORY",organizationId,...await inventory(organizationId)},null,2));
 if(!args.includes("--apply"))return;
 const req={user:{sub:actor.id,orgId:organizationId,role:actor.role,email:actor.email}} as Request;
 const run=await ensureImport(req);const reset=await prisma.createImportRun.updateMany({where:{id:run.id,OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},data:{status:"RUNNING",actorId:actor.id,leaseToken:null,leaseUntil:null,nextScanAt:new Date(),cursorJson:{phase:0,after:""}}});if(!reset.count)throw new Error("Another worker is processing this organization. Follow its progress in Create.");
 for(;;){await processImports(25,organizationId);const current=await prisma.createImportRun.findUniqueOrThrow({where:{id:run.id}});if(current.status==="PAUSED")throw new Error(current.lastError||"Import paused; resume in Create.");if(current.status==="IDLE")break;if(current.leaseToken)throw new Error("Another worker is processing this organization. Follow its progress in Create.");}
 console.log(JSON.stringify({mode:"APPLIED",organizationId,...await inventory(organizationId)},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Import failed.");process.exitCode=1;}).finally(()=>prisma.$disconnect());
