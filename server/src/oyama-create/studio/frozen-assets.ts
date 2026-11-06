import { createHash } from "node:crypto";
import type { LetterSnapshot } from "../../services/letter-production-contract.js";
import { CreateError, object } from "../domain.js";
/** One immutable copy of each asset per approved release, regardless of recipient count. */
export function compactStudioAssets(jobs:Array<{payloadJson:unknown}>) {
  const bundle:Record<string,string>={};
  for(const job of jobs){
    const artifacts=object(object(job.payloadJson).studio).artifacts;
    if(!Array.isArray(artifacts))continue;
    for(const artifact of artifacts){
      const snapshot=object(object(artifact).snapshot);
      for(const assets of [snapshot.assets,object(snapshot.studio).assets])for(const [source,value] of Object.entries(object(assets))){
          if(typeof value!=="string"||value.length<500||value.startsWith("@create-asset:"))continue;
          const key=createHash("sha256").update(value).digest("hex");bundle[key]=value;object(assets)[source]=`@create-asset:${key}`;
        }
    }
  }
  return bundle;
}
export function hydrateStudioAssets(letter:LetterSnapshot,bundle:Record<string,string>={}) {
  for(const assets of [letter.assets,letter.studio?.assets])if(assets)for(const [source,value] of Object.entries(assets))if(value.startsWith("@create-asset:")){
      const frozen=bundle[value.slice("@create-asset:".length)];if(!frozen)throw new CreateError(422,"An approved print asset is missing from its frozen release.");assets[source]=frozen;
    }
}
