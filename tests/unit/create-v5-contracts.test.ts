import { describe, expect, it } from "vitest";
import { defaultDesign, dimensions, normalizeDesign } from "@/server/src/oyama-create/studio/design";
import { upgradeUnifiedDesign, tokenizeMergeText } from "@/server/src/oyama-create/studio/unified-document";
import { renderStudio, emptyDonor } from "@/server/src/oyama-create/studio/render";
import { exportHtmlDocument } from "@/server/src/oyama-create/studio/html-document";
import { normalizeWorkspaceLayout } from "@/app/components/oyama-create/v5/layout-state";
import { paginateFlow } from "@/server/src/oyama-create/studio/pagination";
import { printFontAssets } from "@/server/src/oyama-create/studio/print-fonts";
const brand = { version: 1 as const, identity: {}, profiles: [], signers: [], presets: [], defaultSignerId: null };
describe("Create v5 compatibility contract", () => {
  it("upgrades copy without changing the original or block identities", () => {
    const original = defaultDesign(); original.body.content[0].content = [{ type: "text", text: "Dear {first} {{contact.last_name}},", marks: [{ type: "bold" }] }];
    const next = upgradeUnifiedDesign(original);
    expect(next.version).toBe(4); expect(original.version).toBe(2);
    expect(next.body.content[0].attrs?.studioId).toBe("opening");
    const fields = next.body.content[0].content!.filter(node => node.type === "mergeField");
    expect(fields.map(node => node.attrs?.field)).toEqual(["donor.firstName", "donor.lastName"]);
    expect(fields[0].attrs?.rawToken).toBe("{first}"); expect(fields[0].marks).toEqual([{ type: "bold" }]);
    expect(upgradeUnifiedDesign(next)).toEqual(next);
  });
  it("retains merge filters, unsupported fields and authoring tokens", () => {
    const nodes = tokenizeMergeText("{{gift.amount|currency}} {{unknown.keep_me}}", []);
    expect(nodes[0].type).toBe("mergeField"); expect(nodes[0].attrs?.rawToken).toBe("{{gift.amount|currency}}");
    expect(nodes.at(-1)?.text).toContain("{{unknown.keep_me}}");
    const design = upgradeUnifiedDesign(defaultDesign()); design.body.content[0].content = nodes;
    expect(exportHtmlDocument(design, brand)).toContain("{{gift.amount|currency}}");
  });
  it("resolves protected tokens without leaking sensitive data or recipient values to public channels", () => {
    const design = upgradeUnifiedDesign(defaultDesign()); design.body.content[0].content = tokenizeMergeText("{first} {{gift.amount}}", []);
    const donor = { ...emptyDonor(), available: true, name: "Jordan", sensitiveAllowed: false, mergeValues: { "donor.firstName": "Jordan", "gift.amount": "SECRET" } };
    expect(renderStudio(design, donor, brand).html).toContain("Jordan");
    expect(renderStudio(design, donor, brand).html).not.toContain("SECRET");
    const publicView = renderStudio(design, donor, brand, { channel: "WEB" });
    expect(publicView.html).not.toContain("Jordan"); expect(publicView.issues.some(item => item.code === "PRIVATE_CHANNEL")).toBe(true);
  });
  it("retains requested fonts and supports physical Half Letter independent of UI layout", () => {
    const design = upgradeUnifiedDesign(defaultDesign()); design.page.paper = "HALF_LETTER"; design.styles.font = "Georgia";
    const normalized = normalizeDesign(design);
    expect(normalized.styles.font).toBe("Georgia"); expect(dimensions(normalized.page)).toMatchObject({ width: 528, height: 816 });
    design.styles.font = "Calibri";
    expect(normalizeDesign(design).styles.font).toBe("Calibri");
    expect(normalizeDesign({ ...defaultDesign(), version: 3 }).version).toBe(3);
  });
  it("keeps formatting around resolved protected fields and preserves requested inline fonts", () => {
    const design=upgradeUnifiedDesign(defaultDesign());
    design.body.content[0].content=tokenizeMergeText("{first}",[{type:"bold"},{type:"textStyle",attrs:{fontFamily:"Georgia"}}]);
    const rendered=renderStudio(design,{...emptyDonor(),available:true,mergeValues:{"donor.firstName":"Jordan"}},brand);
    expect(rendered.html).toContain("<strong>Jordan</strong>");expect(rendered.html).toContain("font-family:'Georgia'");
  });
  it("clamps corrupted view preferences and never includes document content", () => {
    expect(normalizeWorkspaceLayout({ left: -100, right: 4000, zoom: 10000, content: "private" })).toMatchObject({ left: 180, right: 460, zoom: 200 });
    expect(normalizeWorkspaceLayout(null)).toMatchObject({ left: 235, right: 296, compact: false, leftOpen: true, rightOpen: true });
    expect(normalizeWorkspaceLayout({ content: "private" })).not.toHaveProperty("content");
  });
  it("derives page boundaries without splitting indivisible rows and honors manual breaks", () => {
    const result = paginateFlow([{position:1,top:0,bottom:400},{position:20,top:400,bottom:500},{position:30,top:500,bottom:500,hardBreak:true}],450,600);
    expect(result.breaks).toEqual([{position:20,height:200,table:false},{position:30,height:500,table:false}]);
    expect(result.pages).toBe(3);
    const grouped=paginateFlow([{position:1,top:0,bottom:380},{position:20,top:380,bottom:420,keepWithNext:true},{position:30,top:420,bottom:470}],450,600);
    expect(grouped.breaks[0].position).toBe(20);
    const table=paginateFlow([{position:1,top:0,bottom:400},{position:20,top:400,bottom:470,table:true,columns:2,headerHeight:30}],450,600);
    expect(table.breaks[0]).toEqual({position:20,height:230,table:true,columns:2,headerHeight:30});
  });
  it("freezes bundled fonts and reports an unavailable requested font rather than substituting it", async () => {
    const design = upgradeUnifiedDesign(defaultDesign());
    expect((await printFontAssets(design)).issues).toEqual([]);
    design.styles.font="Georgia";
    const checked = await printFontAssets(design);
    // A licensed installation may provide Georgia; absence must be explicit.
    expect(checked.assets["font:Georgia"] || checked.issues.find(issue=>issue.code==="PRINT_FONT_UNAVAILABLE"&&issue.message.includes("Georgia"))).toBeTruthy();
  });
});
