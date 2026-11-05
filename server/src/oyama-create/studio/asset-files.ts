import path from "node:path";
import { stat } from "node:fs/promises";
import { managedPublicMedia, mapHtmlImageSources } from "../../lib/public-media.js";
import type { StudioIssue } from "./types.js";

/** Never fetch remote URLs. Check managed files once per preview/release request. */
export async function managedAssetIssues(org:string,html:string,cache=new Map<string,Promise<boolean>>()):Promise<StudioIssue[]>{
  const sources=new Set<string>();mapHtmlImageSources(html,source=>{const media=managedPublicMedia(source);if(media&&media.organizationId===org)sources.add(media.storagePath);return source;});
  const issues:StudioIssue[]=[],paths=[...sources];
  for(let offset=0;offset<paths.length;offset+=20)await Promise.all(paths.slice(offset,offset+20).map(async source=>{
    let exists=cache.get(source);if(!exists){exists=stat(path.resolve("public",...source.split("/").filter(Boolean))).then(file=>file.isFile(),()=>false);cache.set(source,exists);}
    if(!await exists)issues.push({code:"IMAGE_MISSING",message:`Missing image ${source}. Replace or upload it in Create before release.`,blocking:true});
  }));
  return issues;
}
