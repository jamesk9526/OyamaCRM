"use client";

import { useEffect, useState } from "react";

interface EventBrandLogoProps {
  name: string;
  primaryUrl?: string | null;
  secondaryUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

function safeImageUrl(value?: string | null): string {
  const url = value?.trim() ?? "";
  if (/^\/(?!\/)[^\s]*$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "";
  } catch {
    return "";
  }
}

export default function EventBrandLogo({ name, primaryUrl, secondaryUrl, className, fallbackClassName }: EventBrandLogoProps) {
  const candidates = [safeImageUrl(primaryUrl), safeImageUrl(secondaryUrl)].filter((url, index, all) => url && all.indexOf(url) === index);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  useEffect(() => setFailedUrls([]), [primaryUrl, secondaryUrl]);
  const url = candidates.find((candidate) => !failedUrls.includes(candidate));
  if (url) return <img src={url} alt={`${name} logo`} className={className} onError={() => setFailedUrls((failed) => [...failed, url])} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "EV";
  return <span role="img" aria-label={`${name} logo`} className={fallbackClassName}>{initials}</span>;
}
