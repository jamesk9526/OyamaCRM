import { isDonorLibraryReportKey, type DonorLibraryReport } from "./donor-report-library.js";
export interface CustomReportDefinition { name: string; source: string; from: string; through: string; columns: string[]; groupBy: string; metric: string; contains: string }
export function validateCustomReport(value: unknown): CustomReportDefinition {
 const d = value as CustomReportDefinition;
 if (!d || typeof d.name !== "string" || !d.name.trim() || d.name.length > 120 || typeof d.source !== "string" || !isDonorLibraryReportKey(d.source) || !Array.isArray(d.columns) || !d.columns.length || d.columns.length > 40 || d.columns.some(c => typeof c !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(c)) || typeof d.groupBy !== "string" || typeof d.metric !== "string" || typeof d.contains !== "string" || d.contains.length > 100) throw Object.assign(new Error("Choose a name, report source and valid columns."), { status: 400 });
 for (const date of [d.from,d.through]) if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw Object.assign(new Error("Choose valid report dates."), {status:400});
 if(d.from > d.through) throw Object.assign(new Error("Start date must precede end date."),{status:400});
 return {name:d.name.trim(),source:d.source,from:d.from,through:d.through,columns:[...new Set(d.columns)],groupBy:d.groupBy.slice(0,64),metric:d.metric.slice(0,64),contains:d.contains.trim()};
}
export function transformCustomReport(report: DonorLibraryReport, definition: CustomReportDefinition) {
 const keys = new Set(report.columns.map(c=>c.key));
 if(definition.columns.some(c=>!keys.has(c)) || definition.groupBy && !keys.has(definition.groupBy) || definition.metric && !report.columns.some(c=>c.key===definition.metric && c.type === "currency")) throw Object.assign(new Error("Columns changed. Preview the source and choose your columns again."),{status:400});
 const rows = report.rows.filter(row=>!definition.contains || report.columns.some(c=>String(row[c.key]??"").toLowerCase().includes(definition.contains.toLowerCase())));
 if(!definition.groupBy) return {...report,title:definition.name,columns:report.columns.filter(c=>definition.columns.includes(c.key)),rows:rows.map(row=>Object.fromEntries(definition.columns.map(key=>[key,row[key]??null]))),summary:[{label:"Matching rows",value:rows.length,type:"number" as const}],audienceConstituentIds:undefined,comparisonMatrix:undefined};
 const groups = new Map<string,{label:string;count:number;cents:number}>();
 for(const row of rows) { const label=String(row[definition.groupBy]??"Unspecified");const group=groups.get(label)||{label,count:0,cents:0};group.count++;if(definition.metric)group.cents+=Math.round(Number(row[definition.metric]??0)*100);groups.set(label,group); }
 return {...report,title:definition.name,columns:[{key:"group",label:report.columns.find(c=>c.key===definition.groupBy)!.label},{key:"count",label:"Records",type:"number" as const},...(definition.metric?[{key:"total",label:report.columns.find(c=>c.key===definition.metric)!.label,type:"currency" as const}]:[])],rows:[...groups.values()].sort((a,b)=>b.cents-a.cents||b.count-a.count||a.label.localeCompare(b.label)).map(g=>({group:g.label,count:g.count,...(definition.metric?{total:g.cents/100}:{})})),summary:[{label:"Matching records",value:rows.length,type:"number" as const},{label:"Groups",value:groups.size,type:"number" as const}],audienceConstituentIds:undefined,comparisonMatrix:undefined};
}
