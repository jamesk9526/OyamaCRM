import { CreateError } from "../domain.js";
/** Authored output may reference external images, but never another tenant's managed uploads. */
export function assertStudioAssetOwnership(org:string,value:unknown) {
  if(Array.isArray(value)){for(const item of value)assertStudioAssetOwnership(org,item);return;}
  if(!value||typeof value!=="object")return;
  for(const [key,item] of Object.entries(value)){
    if(typeof item==="string"&&(/^(src|logoUrl|logoSquareUrl|signatureImageUrl)$/.test(key)||key.endsWith("avatarUrl"))){
      let path=item;try{path=new URL(item,"https://studio.invalid").pathname;}catch{continue;}
      const match=path.match(/^\/uploads\/(?:letter-media|branding|email-media)\/([^/]+)\//);
      if(match&&match[1]!==org)throw new CreateError(403,"Select an asset uploaded to this organization.");
    }else if(item&&typeof item==="object")assertStudioAssetOwnership(org,item);
  }
}
