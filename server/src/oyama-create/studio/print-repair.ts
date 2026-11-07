import { DomUtils, parseDocument } from "htmlparser2";
import { sanitizeStudioHtml } from "./html.js";

export type PrintRegionRepair = { region: "firstHeader" | "header" | "firstFooter" | "footer"; margin: "top" | "bottom"; required: number; available: number };

/** An explicit draft edit. Recipient tokens and copy stay unmerged. */
export function compactPrintRegionHtml(html: string): string {
  const document = parseDocument(sanitizeStudioHtml(html, true));
  for (const node of DomUtils.getElementsByTagName("*", document.children)) {
    const styles = (node.attribs.style || "").split(";").filter(value => !/^\s*(margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|height|min-height|font-size|line-height)\s*:/i.test(value)
      && !(node.name === "img" && /^\s*(width|max-width|max-height|object-fit)\s*:/i.test(value)));
    if (node.name === "img") styles.push("max-width:160px", "max-height:40px", "width:auto", "height:auto", "object-fit:contain");
    else styles.push("margin:0", "padding:0", "line-height:1.2", `font-size:${/^h[1-6]$/.test(node.name) ? 14 : 9}pt`);
    node.attribs.style = styles.filter(Boolean).join(";");
    if (node.name === "p" && !DomUtils.textContent(node).trim() && !DomUtils.getElementsByTagName("img", node.children).length) DomUtils.removeElement(node);
  }
  return sanitizeStudioHtml(DomUtils.getOuterHTML(document), true);
}
