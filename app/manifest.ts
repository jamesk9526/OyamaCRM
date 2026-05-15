/** Web app manifest for the AGENTSteward PWA. */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AGENTSteward — OyamaCRM",
    short_name: "Steward AI",
    description: "AI-powered CRM assistant for donor management and fundraising intelligence.",
    start_url: "/steward-ai-workspace",
    scope: "/steward-ai-workspace",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/api/pwa/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New Chat",
        url: "/steward-ai-workspace?new=1",
        description: "Start a new conversation with Steward",
      },
    ],
  };
}
