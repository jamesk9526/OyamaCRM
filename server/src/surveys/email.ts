import { accentText, boundedText, parseAppearance, record, invalid, type Appearance } from "./definition.js";
export type EmailDesign = { heading: string; buttonLabel: string; signature: string };
export function parseEmailDesign(value: unknown): EmailDesign {
  const input = value == null ? {} : record(value);
  return { heading: boundedText(input.heading ?? "", "Email heading", 160), buttonLabel: boundedText(input.buttonLabel ?? "Open survey", "Survey link button", 80, true), signature: boundedText(input.signature ?? "", "Email signature", 1000) };
}
export function validateEmailTokens(message: string) {
  for (const token of message.matchAll(/{{(.*?)}}/g)) if (!["name", "survey_link"].includes(token[1].trim())) invalid("Use only {{name}} and {{survey_link}} in the invitation message.");
}
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function renderSurveyEmail(input: { message: string; design?: unknown; appearance?: Appearance; name: string; surveyUrl: string; origin: string; plain?: boolean; preferences?: { label: string; href: string }[] }) {
  const theme = parseAppearance(input.appearance), design = parseEmailDesign(input.design);
  const message = input.message.replace(/{{\s*(name|survey_link)\s*}}/g, (_all, key: string) => key === "name" ? input.name : input.surveyUrl);
  const lines = [design.heading, message, design.signature, `${design.buttonLabel}: ${input.surveyUrl}`, ...(input.preferences ?? []).map(link => `${link.label}: ${link.href}`)].filter(Boolean);
  const block = (v: string) => escape(v).replace(/\r?\n/g, "<br>");
  if (input.plain) return { text: `${message}\n\n${[{ label: design.buttonLabel, href: input.surveyUrl }, ...(input.preferences ?? [])].map(link => `${link.label}: ${link.href}`).join("\n")}`, html: `<p>${block(message)}</p><p><a href="${escape(input.surveyUrl)}">Open survey</a></p>` };
  const logo = theme.logoUrl ? new URL(theme.logoUrl, input.origin).href : "";
  const markup = `<div style="background:${theme.backgroundColor};padding:24px;font-family:${theme.font === "serif" ? "Georgia,serif" : "Arial,sans-serif"};color:#142f4d"><div style="max-width:600px;margin:auto;background:#ffffff;padding:28px;border-top:5px solid ${theme.accentColor}">${logo ? `<img src="${escape(logo)}" alt="${escape(theme.logoAlt)}" style="max-width:220px;max-height:96px;object-fit:contain">` : ""}${design.heading ? `<h1 style="font-size:24px">${block(design.heading)}</h1>` : ""}<p style="line-height:1.65">${block(message)}</p><p style="margin:24px 0"><a href="${escape(input.surveyUrl)}" style="display:inline-block;background:${theme.accentColor};color:${accentText(theme.accentColor)};padding:14px 22px;text-decoration:none;border-radius:6px">${escape(design.buttonLabel)}</a></p>${design.signature ? `<p style="line-height:1.6">${block(design.signature)}</p>` : ""}<p style="font-size:12px">Or copy this survey link: <a href="${escape(input.surveyUrl)}">${escape(input.surveyUrl)}</a></p>${(input.preferences ?? []).map(link => `<p style="font-size:12px"><a href="${escape(link.href)}">${escape(link.label)}</a></p>`).join("")}</div></div>`;
  return { text: lines.join("\n\n"), html: markup };
}
