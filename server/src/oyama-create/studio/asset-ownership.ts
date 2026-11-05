import { CreateError } from "../domain.js";
import { managedPublicMedia, mapHtmlImageSources } from "../../lib/public-media.js";
/** Authored output may reference external images, but never another tenant's managed uploads. */
export function assertStudioAssetOwnership(org:string,value:unknown) {
  if(Array.isArray(value)){for(const item of value)assertStudioAssetOwnership(org,item);return;}
  if(!value||typeof value!=="object")return;
  for(const [key,item] of Object.entries(value)){
    if(typeof item==="string"&&(/^(src|logoUrl|logoSquareUrl|signatureImageUrl|thumbnail)$/.test(key)||key.endsWith("avatarUrl"))){
      assertSource(item);
    }else if(typeof item==="string"&&/html$/i.test(key)){
      mapHtmlImageSources(item,assertSource);
    }else if(item&&typeof item==="object")assertStudioAssetOwnership(org,item);
  }
  function assertSource(source:string){const media=managedPublicMedia(source);if(media&&media.organizationId!==org)throw new CreateError(403,"Select an asset uploaded to this organization.");return source;}
}
