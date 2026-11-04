import { toPublicSiteEmbedConfig, type SiteEmbedSiteConfig } from "../../services/site-embeds.js";
import { WIDGET_BRAND_FIELDS } from "./brand.js";
import { publicBrandIdentity } from "./brand-service.js";
export function widgetBrandValues(site:SiteEmbedSiteConfig) {
  const result:Record<string,string> = {};
  for(const path of WIDGET_BRAND_FIELDS){let value:unknown=site;for(const key of path.split("."))value=value&&typeof value==="object"?(value as Record<string,unknown>)[key]:undefined;if(typeof value==="string")result[path]=value;}
  return result;
}
export async function brandedPublicEmbed(org:string,site:SiteEmbedSiteConfig,channel:"WIDGET"|"GIVING") {
  const publicConfig=toPublicSiteEmbedConfig(site),brand=await publicBrandIdentity(org,channel,site.id);
  if(!brand)return {publicConfig,identity:null};
  for(const path of WIDGET_BRAND_FIELDS){const value=brand[path];if(typeof value!=="string")continue;const keys=path.split(".");let target=publicConfig as unknown as Record<string,unknown>;for(const key of keys.slice(0,-1)){if(!target[key]||typeof target[key]!=="object")break;target=target[key] as Record<string,unknown>;}target[keys[keys.length-1]]=value;}
  return {publicConfig,identity:brand};
}
