/** Public communication assets use the CRM host, independent of the host used at upload time.
 * This module is also used in browser previews; it must not read files or environment variables.
 */
export function managedPublicMedia(value: string) {
  let candidate = value.trim();
  if (/^(?:https?:)?\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate, "https://media.invalid");
      if (url.username || url.password) return null;
      candidate = `${url.pathname}${url.search}${url.hash}`;
    } catch { return null; }
  }
  candidate = candidate.replace(/^\/api\/letters\/media\//i, "/uploads/letter-media/")
    .replace(/^\/api\/email-campaigns\/media\//i, "/uploads/email-media/")
    .replace(/^\/api\/public-media\/branding\//i, "/uploads/branding/");
  const match = /^\/uploads\/(branding|email-media|letter-media)\/([a-z0-9_-]+)\/([a-z0-9][a-z0-9._-]{0,200}\.(?:png|jpe?g|webp|gif))([?#].*)?$/i.exec(candidate);
  if (!match || match[3].includes("..")) return null;
  const namespace = match[1].toLowerCase();
  const organizationId = match[2], fileName = match[3], suffix = match[4] || "";
  const storagePath = `/uploads/${namespace}/${organizationId}/${fileName}`;
  const publicPath = namespace === "branding" ? `/api/public-media/branding/${organizationId}/${fileName}` : `/api/${namespace === "letter-media" ? "letters" : "email-campaigns"}/media/${organizationId}/${fileName}`;
  return { namespace, organizationId, fileName, storagePath, publicUrl: `${publicPath}${suffix}` };
}

export function normalizePublicMediaUrl(value: string): string {
  return managedPublicMedia(value)?.publicUrl || value.trim();
}

/** Rewrite actual source attributes (including old unquoted HTML and Outlook VML) and CSS images.
 * Links, merge tokens, embedded bytes and cid attachments retain their meaning.
 */
export function mapHtmlImageSources(html: string, resolve: (value: string) => string): string {
  return html.replace(/(\s)(src|poster|background)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (_attribute, space: string, name: string, double: string | undefined, single: string | undefined, bare: string | undefined) => {
      const quote = single === undefined ? '"' : "'";
      return `${space}${name}=${quote}${resolve(double ?? single ?? bare ?? "")}${quote}`;
    })
    .replace(/(\ssrcset\s*=\s*)(["'])(.*?)\2/gi, (attribute, prefix: string, quote: string, value: string) => {
      if (/data:/i.test(value)) return attribute;
      return `${prefix}${quote}${value.split(",").map(part => part.replace(/^(\s*)(\S+)/, (_match, space: string, url: string) => `${space}${resolve(url)}`)).join(",")}${quote}`;
    })
    .replace(/url\(\s*(["']?)([^'"()]*?)\1\s*\)/gi, (_match, quote: string, value: string) => `url(${quote}${resolve(value)}${quote})`);
}

export function normalizeHtmlImageSources(html: string): string {
  return mapHtmlImageSources(html, normalizePublicMediaUrl);
}
