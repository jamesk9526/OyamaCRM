import { describe, expect, it } from "vitest";
import { exportHtmlDocument, importHtmlDocument } from "@/server/src/oyama-create/studio/html-document";
import { defaultDesign, normalizeDesign, sourceIdentity, walkNodes } from "@/server/src/oyama-create/studio/design";
import { paragraph, newBlock } from "@/server/src/oyama-create/studio/registry";
import { emptyDonor, renderStudio } from "@/server/src/oyama-create/studio/render";
import type { BrandDocument } from "@/server/src/oyama-create/studio/types";
const brand:BrandDocument={version:1,identity:{organizationDisplayName:"Synthetic foundation"},presets:[],signers:[],profiles:[],defaultSignerId:null};
const fixture=()=>{const design=defaultDesign();design.body.content=[paragraph("opening","Hello {{donor.fullName}}"),newBlock("studioHistory","giving"),newBlock("studioColumns","columns"),newBlock("studioSignature","signature")];return design;};
describe("whole letter HTML authoring",()=>{
  it("round-trips unchanged source including CRM blocks, fields, IDs, branding modes and columns",()=>{
    const design=fixture(),html=exportHtmlDocument(design,brand),result=importHtmlDocument(design,brand,html);
    expect(html).toContain("{{donor.fullName}}");expect(html).toContain('data-oyama-region="firstHeader"');expect(html).toContain('data-oyama-region="footer"');expect(result.design).toEqual(design);expect(result.diagnostics).toEqual([]);
  });
  it("edits all shared copy while preserving unchanged dynamic blocks and protected channels",()=>{
    const design=fixture();design.version=3;design.channels={EMAIL:{document:{type:"doc",content:[paragraph("email","Protected email")]},reviewedSource:sourceIdentity(design)}};
    const html=exportHtmlDocument(design,brand).replace('Hello {{donor.fullName}}','Thank you {{donor.fullName}}');
    const result=importHtmlDocument(design,brand,html);expect(result.design.body.content[0].attrs?.studioId).toBe('opening');expect(result.design.body.content[0].content?.[0].text).toBe('Thank you {{donor.fullName}}');expect(result.design.body.content[1]).toEqual(design.body.content[1]);expect(result.design.channels).toEqual(normalizeDesign(design).channels);
  });
  it("changes a header independently without duplicating unchanged organization furniture",()=>{
    const design=fixture(),html=exportHtmlDocument(design,brand).replace('Synthetic foundation','Revised header');
    const result=importHtmlDocument(design,brand,html);expect(result.design.regions.firstHeader.mode).toBe('custom');expect(JSON.stringify(result.design.regions.firstHeader.content)).toContain('Revised header');expect(result.design.regions.header).toEqual(design.regions.header);expect(result.design.body).toEqual(design.body);
  });
  it("retains dynamic page-number markers when a footer is edited as HTML",()=>{
    const design=fixture(),source=exportHtmlDocument(design,brand).replace(/(<div data-oyama-region="firstFooter">[\s\S]*?)Synthetic foundation/,'$1Revised footer');
    const result=importHtmlDocument(design,brand,source);expect(result.design.regions.firstFooter.mode).toBe('custom');const footer=JSON.stringify(result.design.regions.firstFooter.content);expect(footer).toContain('data-studio-page-number');expect(footer).toContain('data-studio-total-pages');
  });
  it("exposes authored layout styles and image captions and retains them through edited HTML",()=>{
    const design=fixture();design.body.content=[{type:'studioCallout',attrs:{studioId:'callout',color:'#123456'},content:[paragraph('callout-copy','Original callout')]},{type:'image',attrs:{studioId:'photo',src:'https://example.invalid/image.png',alt:'Example',caption:'Original caption',width:60,height:240,crop:'cover',focalX:25,focalY:50}}];
    const html=exportHtmlDocument(design,brand);expect(html).toContain('background:#123456');expect(html).toContain('object-fit:cover');expect(html).toContain('Original caption');
    const changed=importHtmlDocument(design,brand,html.replace('Original callout','Edited callout').replace('Original caption','Edited caption'));
    const stored=JSON.stringify(changed.design.body);expect(stored).toContain('background:#123456');expect(stored).toContain('Edited caption');expect(stored).toContain('object-fit:cover');
  });
  it("accepts complete pasted HTML, preserves complex layouts, removes active markup and requires review",()=>{
    const design=fixture();design.pack.replySlip.enabled=true;
    const result=importHtmlDocument(design,brand,'<!doctype html><html><body><div style="background:#edf4fc;padding:16px"><h2>New letter</h2><p>{{donor.fullName}}</p><table><tr><td>Retained table</td></tr></table></div><script>alert(1)</script></body></html>');
    expect(result.design.body.content[0].type).toBe('studioHtml');expect(JSON.stringify(result.design.body)).toContain('Retained table');expect(JSON.stringify(result.design.body)).not.toContain('alert(1)');expect(Object.values(result.design.regions).every(region=>region.mode==='none')).toBe(true);expect(result.design.pack.replySlip.enabled).toBe(false);expect(renderStudio(result.design,emptyDonor(),brand).issues.some(issue=>issue.code==='HTML_REVIEW')).toBe(true);
  });
  it("retains large referenced originals when unchanged rather than copying their payload into the editor schema",()=>{
    const design=fixture();design.version=3;design.body.content=[{type:'studioHtml',attrs:{studioId:'large',html:'',sourceRevisionId:'original-revision',reviewedHtml:'original-revision'}}];
    const hydrated=structuredClone(design);hydrated.body.content[0].attrs!.html='<div style="padding:12px">'+'Large original. '.repeat(10000)+'</div>';
    const result=importHtmlDocument(design,brand,exportHtmlDocument(design,brand,'SHARED',hydrated),'SHARED',hydrated);expect(result.design.body).toEqual(design.body);
  });
  it("preserves format visibility and supports repeated HTML edits and duplicated chunks without ID collisions",()=>{
    const design=fixture();design.body.content[0].attrs!.printOnly=true;
    const first=importHtmlDocument(design,brand,exportHtmlDocument(design,brand).replace('Hello','Updated')).design;
    const source=exportHtmlDocument(first,brand),second=importHtmlDocument(first,brand,source.replace('Updated','Updated again')).design;
    expect(second.body.content[0].attrs).toMatchObject({studioId:'opening',printOnly:true});
    const extra=source.replace('</main>','<div data-oyama-block="body:opening"><p>Duplicated copy</p></div></main>'),copy=importHtmlDocument(first,brand,extra).design;
    const ids=walkNodes(copy.body).map(node=>node.attrs?.studioId).filter(Boolean);expect(new Set(ids).size).toBe(ids.length);
  });
  it("edits a protected Letter adaptation without changing shared or Email content",()=>{
    const design=fixture();design.version=3;design.channels={LETTER:{document:{type:'doc',content:[paragraph('letter','Custom letter')]},reviewedSource:sourceIdentity(design)}};
    const result=importHtmlDocument(design,brand,exportHtmlDocument(design,brand,'LETTER').replace('Custom letter','Revised letter'),'LETTER');expect(result.design.body).toEqual(design.body);expect(JSON.stringify(result.design.channels!.LETTER!.document)).toContain('Revised letter');expect(result.design.channels!.LETTER!.reviewedSource).toBeNull();
  });
  it("rejects empty and malformed region replacements without mutating the original",()=>{
    const design=fixture(),original=structuredClone(design);expect(()=>importHtmlDocument(design,brand,'<script>bad()</script>')).toThrow(/no letter content/);expect(()=>importHtmlDocument(design,brand,'<div data-oyama-region="body">One</div><div data-oyama-region="body">Two</div>')).toThrow(/only one body/);expect(()=>importHtmlDocument(design,brand,'<div data-oyama-region="unknown">No</div>')).toThrow(/Unknown/);expect(design).toEqual(original);
  });
  it("rejects content outside managed regions and excessive nesting instead of silently dropping it",()=>{
    const design=fixture(),html=exportHtmlDocument(design,brand).replace('</body>','<p>Outside the editable body</p></body>');
    expect(()=>importHtmlDocument(design,brand,html)).toThrow(/inside data-oyama-region/);
    expect(()=>importHtmlDocument(design,brand,'<div>'.repeat(70)+'Content'+'</div>'.repeat(70))).toThrow(/deeply nested/);
  });
});
