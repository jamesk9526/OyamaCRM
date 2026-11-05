import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { managedPublicMedia } from "../lib/public-media.js";
import { studioImageSize } from "./studio/image-metadata.js";
import { CreateError } from "./domain.js";
const namespaces=["branding","email-media","letter-media"] as const;
export async function unregisteredUploads(org:string){
  if(!/^[a-z0-9_-]+$/i.test(org))throw new CreateError(400,"Invalid organization identity.");
  const registered=await prisma.createStudioAsset.findMany({where:{organizationId:org},select:{url:true}}),known=new Set(registered.map(item=>managedPublicMedia(item.url)?.storagePath||item.url));
  const items:Array<{id:string;name:string;storagePath:string}>=[];
  for(const namespace of namespaces){
    const directory=path.resolve("public","uploads",namespace,org);let names:string[];
    try{names=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")continue;throw error;}
    for(const name of names){const storagePath=`/uploads/${namespace}/${org}/${name}`;if(managedPublicMedia(storagePath)&&!known.has(storagePath))items.push({id:`${namespace}/${name}`,name,storagePath});}
  }
  return items.sort((a,b)=>a.id.localeCompare(b.id));
}
export async function registerUpload(org:string,actor:string,storagePath:string){
  const media=managedPublicMedia(storagePath);if(!media||media.organizationId!==org)throw new CreateError(403,"Only this organization's uploaded images can be imported.");
  const file=path.resolve("public",...media.storagePath.split("/").filter(Boolean)),directory=path.resolve("public","uploads",media.namespace,org);
  if(path.dirname(file)!==directory)throw new CreateError(403,"Invalid asset path.");
  const metadata=await stat(file);if(!metadata.isFile()||metadata.size>50000000)throw new CreateError(422,"Image exceeds the 50 MB import limit. Its original remains in upload storage.");
  const bytes=await readFile(file),extension=path.extname(media.fileName).toLowerCase(),mime=extension===".png"?"image/png":extension===".gif"?"image/gif":extension===".webp"?"image/webp":"image/jpeg";
  const size=mime==="image/gif"?{width:bytes.length>=10?bytes.readUInt16LE(6):null,height:bytes.length>=10?bytes.readUInt16LE(8):null}:studioImageSize(bytes,mime);
  const id=`imported-${createHash("sha256").update(`${org}:${media.storagePath}`).digest("hex").slice(0,48)}`;
  return prisma.createStudioAsset.upsert({where:{id},update:{},create:{id,organizationId:org,name:media.fileName,kind:"IMAGE",url:media.publicUrl,mimeType:mime,bytes:bytes.length,width:size.width,height:size.height,checksum:createHash("sha256").update(bytes).digest("hex"),uploadedBy:actor}});
}
