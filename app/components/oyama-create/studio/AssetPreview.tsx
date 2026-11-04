"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded communication assets keep their original bytes. */
import { useState } from "react";
import { normalizePublicMediaUrl } from "@/server/src/lib/public-media";

export default function AssetPreview(props: { src: string; alt: string; className?: string; backgroundControl?: boolean }) {
  const source = normalizePublicMediaUrl(props.src);
  return <Preview key={source} {...props} src={source}/>;
}

function Preview({ src, alt, className = "", backgroundControl = false }: { src: string; alt: string; className?: string; backgroundControl?: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [dark, setDark] = useState(false);
  return <span className={`cs-asset-preview ${className}`}>
    <span className={`cs-asset-preview-image${dark ? " dark" : ""}`}>
      <img src={src} alt={alt} onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} hidden={status === "error"}/>
      {status === "loading" && <span className="cs-image-status" role="status">Loading image…</span>}
      {status === "error" && <span className="cs-image-status error" role="status">Image unavailable. Replace the upload or check its saved URL.</span>}
    </span>
    {backgroundControl && <button type="button" className="oc-button small" aria-pressed={dark} onClick={() => setDark(value => !value)}>{dark ? "Use light preview background" : "Use dark preview background"}</button>}
  </span>;
}
