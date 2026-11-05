import { describe, expect, it } from "vitest";
import type { EmailCampaign, LetterTemplate } from "@prisma/client";
import { convertLegacy } from "@/server/src/oyama-create/studio/conversion";
import { htmlToStudio, sanitizeStudioHtml } from "@/server/src/oyama-create/studio/html";
import { defaultDesign, normalizeDesign, sourceIdentity } from "@/server/src/oyama-create/studio/design";
import { renderStudio, renderEmailDocument, renderRegion, emptyDonor, designSensitive } from "@/server/src/oyama-create/studio/render";
import { renderChannel } from "@/server/src/oyama-create/studio/channel-render";
import { variantFrom } from "@/server/src/oyama-create/domain";
import { newBlock, paragraph } from "@/server/src/oyama-create/studio/registry";
import type { BrandDocument } from "@/server/src/oyama-create/studio/types";
const brand: BrandDocument = {version:1,identity:{},profiles:[],presets:[],signers:[],defaultSignerId:null};
describe("legacy conversion and channel compatibility", () => {
  it("preserves formatting, tables and merge tokens without flattening into plain text", () => {
    const result = htmlToStudio('<p>Hello <strong>{{donor.fullName}}</strong></p><table><tr><td>A</td><td>B</td></tr></table>', 'source');
    expect(result.document.content.map(node=>node.type)).toEqual(['paragraph','table']);
    expect(result.document.content[0].content?.[1].marks).toEqual([{type:'bold'}]);
    expect(result.diagnostics).toEqual([]);
  });
  it("retains complex markup as reviewable HTML and removes active content", () => {
    const converted=htmlToStudio('<div style="background-color:#123456"><p>Keep the layout</p></div><script>bad()</script>','source');
    expect(converted.document.content[0].type).toBe('studioHtml');
    expect(converted.document.content[0].attrs?.html).toContain('background-color:#123456');
    expect(JSON.stringify(converted)).not.toContain('bad()');
    expect(sanitizeStudioHtml('<img src="javascript:bad()" onerror="bad()"><a href="https://example.invalid/a">Safe</a>')).toBe('<img><a href="https://example.invalid/a">Safe</a>');
  });
  it("converts email-only native blocks and keeps the original", () => {
    const original={name:'Email only',subject:'Original subject',previewText:'Preview',bodyHtml:'<p>Original layout</p>',templateJson:JSON.stringify({template:{blocks:[{id:'text',type:'text',content:'<p>Editable copy</p>'},{id:'button',type:'button',label:'Read more',href:'https://example.invalid/read'}]}})} as EmailCampaign;
    const result=convertLegacy(original,'EMAIL');
    expect(result.design.version).toBe(3);expect(result.design.body.content.map(node=>node.type)).toEqual(['paragraph','studioButton']);
    expect(result.design.email.subject).toBe('Original subject');expect(result.originalHtml).toBe(original.bodyHtml);
  });
  it("reads v2 designs and isolates explicitly customized channels", () => {
    const design=defaultDesign();expect(normalizeDesign(design)).toEqual(design);
    design.version=3;design.channels={WEB:{document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Public story'}]}]},reviewedSource:sourceIdentity(design)}};
    expect(renderStudio(design,emptyDonor(),brand,{channel:'WEB'}).text).toBe('Public story');
    expect(renderStudio(design,emptyDonor(),brand,{channel:'LETTER'}).text).not.toContain('Public story');
  });
  it("preserves structured letter merge-field nodes as tokens", () => {
    const letter={name:'Letter',printBody:'<p>Original</p>',printLayoutJson:{},documentSchemaVersion:2,documentJson:{type:'doc',content:[{type:'paragraph',content:[{type:'mergeField',attrs:{token:'donor.fullName'}}]}]}} as unknown as LetterTemplate;
    expect(convertLegacy(letter,'LETTER').design.body.content[0].content?.[0].text).toBe('{{donor.fullName}}');
  });
  it("converts every legacy email block without replacing unrelated block types",()=>{
    const blocks=[{id:'header',type:'header',headerTitle:'Original header'},
      {id:'text',type:'text',content:'<p>Body</p>'},{id:'image',type:'image',src:'https://example.invalid/image.png',alt:'Original image'},
      ...['button','donationButton','eventButton'].map(type=>({id:type,type,label:type,href:'https://example.invalid/action'})),
      {id:'divider',type:'divider'},{id:'spacer',type:'spacer',height:24},{id:'columns',type:'columns',leftHtml:'<p>Left</p>',rightHtml:'<p>Right</p>'},
      {id:'social',type:'social',links:[{label:'Facebook',url:'https://example.invalid/profile'}]},
      {id:'video',type:'video',videoUrl:'https://example.invalid/video',thumbnailUrl:'https://example.invalid/thumbnail.png',videoTitle:'Video'},
      {id:'file',type:'fileLink',fileUrl:'https://example.invalid/document.pdf',fileLabel:'Original document'},
      {id:'html',type:'html',html:'<div style="padding:12px">Original layout</div>'}];
    const result=convertLegacy({name:'All blocks',subject:'Subject',bodyHtml:'Original HTML',templateJson:JSON.stringify({template:{blocks}})} as EmailCampaign,'EMAIL');
    expect(result.design.body.content.map(item=>item.type)).toEqual(['studioHtml','paragraph','image','studioButton','studioButton','studioButton','horizontalRule','letterSpacer','studioColumns','studioSocial','studioVideo','studioFile','studioHtml']);
    expect(JSON.stringify(result.design)).toContain('Original document');expect(JSON.stringify(result.design)).toContain('Original layout');
    expect(String(result.design.body.content[0].attrs?.html)).toContain('background:');
  });
  it("retains long reviewed HTML through schema normalization and blocks unreviewed output",()=>{
    const design=defaultDesign();design.version=3;const html='<div style="color:#123456">'+'Preserved copy. '.repeat(400)+'</div>';
    design.body.content=[{type:'studioHtml',attrs:{studioId:'html',html,reviewedHtml:''}}];
    expect(renderStudio(design,emptyDonor(),brand).issues.some(item=>item.code==='HTML_REVIEW')).toBe(true);
    design.body.content[0].attrs!.reviewedHtml=html;const reviewed=normalizeDesign(design);expect(renderStudio(reviewed,emptyDonor(),brand).issues).toEqual([]);
    reviewed.body.content[0].attrs!.html='';expect(renderStudio(reviewed,emptyDonor(),brand).issues.some(item=>item.code==='SOURCE_HTML')).toBe(true);
  });
  it("does not let a public caption conceal private CTA or consent settings",()=>{
    const design=defaultDesign();design.body.content=[newBlock('studioAddress','private-address')];
    const result=renderChannel(design,emptyDonor(),brand,'SOCIAL',variantFrom({caption:'Public story',ctaLabel:'{{donor.fullName}}'}));
    expect(result.text).toBe('Public story');expect(result.issues.some(item=>item.code==='PRIVATE_CHANNEL')).toBe(true);
    expect(renderChannel(design,emptyDonor(),brand,'SOCIAL',variantFrom({caption:'Public story'})).issues).toEqual([]);
  });
  it("retains channel presentation and keeps page furniture independent of a letter adaptation",()=>{
    const design=defaultDesign();design.version=3;design.channels={LETTER:{document:{type:'doc',content:[paragraph('letter','Adapted letter')]},reviewedSource:sourceIdentity(design)},EMAIL:{document:{type:'doc',content:[paragraph('email','Adapted email')]},reviewedSource:sourceIdentity(design),presentation:{emailWidth:720,suppressEmailChrome:true}}};
    design.regions.header={mode:'custom',presetId:'',content:{type:'doc',content:[paragraph('header','Actual header')]}};
    expect(renderRegion(design,emptyDonor(),brand,'header')).toContain('Actual header');expect(renderRegion(design,emptyDonor(),brand,'header')).not.toContain('Adapted letter');
    expect(renderEmailDocument(design,emptyDonor(),brand).html).toContain('max-width:720px');
  });
  it("detects sensitive data in protected adaptations and requires fresh review after shared edits",()=>{
    const design=defaultDesign();design.version=3;design.channels={EMAIL:{document:{type:'doc',content:[newBlock('studioHistory','history')]},reviewedSource:sourceIdentity(design)}};
    expect(designSensitive(design)).toBe(true);design.body.content.push(paragraph('changed','Updated shared source'));
    expect(renderEmailDocument(design,emptyDonor(),brand).issues.some(item=>item.code==='CHANNEL_REVIEW')).toBe(true);
  });
  it("renders appeal-pack pieces through the same channel contract",()=>{
    const design=defaultDesign();design.body.content=[paragraph('letter','Main letter copy')];design.pack.replySlip={enabled:true,placement:'separate',content:{type:'doc',content:[paragraph('reply','Reply slip copy')]}};
    expect(renderChannel(design,emptyDonor(),brand,'LETTER',variantFrom({}),'REPLY_SLIP').text).toBe('Reply slip copy');
    const envelope=renderChannel(design,{...emptyDonor(),available:true,name:'Synthetic recipient',address:'100 Test Way'},brand,'LETTER',variantFrom({}),'OUTER_ENVELOPE');
    expect(envelope.html).toContain('Synthetic recipient');expect(envelope.html).not.toContain('Main letter copy');
  });
});
