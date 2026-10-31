import { describe,it,expect } from "vitest";
import { validateCustomReport,transformCustomReport } from "@/server/src/services/custom-donor-report";
import type { DonorLibraryReport } from "@/server/src/services/donor-report-library";
const definition={name:"Funds",source:"donations",from:"2026-01-01",through:"2026-10-30",columns:["designation","amount"],groupBy:"designation",metric:"amount",contains:""};
const report:DonorLibraryReport={report:"donations",title:"Donations",description:"Completed gifts",period:null,summary:[],columns:[{key:"designation",label:"Fund"},{key:"amount",label:"Amount",type:"currency"}],rows:[{designation:"General",amount:0.1,donorId:"hidden"},{designation:"General",amount:0.2},{designation:"Building",amount:50}],notices:[],generatedAt:new Date().toISOString()};
describe("custom donor report definitions",()=>{
 it("groups giving using integer cents",()=>{const result=transformCustomReport(report,validateCustomReport(definition));expect(result.rows).toEqual([{group:"Building",count:1,total:50},{group:"General",count:2,total:0.3}]);});
 it("filters before grouping",()=>{expect(transformCustomReport(report,{...definition,contains:"general"}).rows).toEqual([{group:"General",count:2,total:0.3}]);});
 it("does not expose hidden grouping or aggregate fields",()=>{expect(()=>transformCustomReport(report,{...definition,groupBy:"donorId"})).toThrow();expect(()=>transformCustomReport(report,{...definition,metric:"designation"})).toThrow();});
 it("selects visible columns for individual rows",()=>{expect(transformCustomReport(report,{...definition,groupBy:"",columns:["amount"]}).columns).toEqual([{key:"amount",label:"Amount",type:"currency"}]);});
 it.each([{from:"2026-02-30"},{through:"2025-01-01"},{columns:[]},{source:"arbitrary-sql"},{contains:"x".repeat(101)},{name:" "}])("rejects invalid definition %j",patch=>{expect(()=>validateCustomReport({...definition,...patch})).toThrow();});
 it("keeps empty results explicit",()=>{expect(transformCustomReport(report,{...definition,contains:"not found"}).rows).toEqual([]);});
});
