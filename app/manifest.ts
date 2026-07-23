/** Web app manifest for the full OyamaCRM PWA experience. */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OyamaCRM v1.3",
    short_name: "OyamaCRM v1.3",
    description: "Nonprofit CRM for donor management, communications, events, and stewardship.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
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
        src: "/api/pwa/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa/icon?size=512",
        sizes: "512x512",
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
        name: "Constituents",
        url: "/constituents",
        description: "Open donor and constituent records",
      },
      {
        name: "Donations",
        url: "/donations",
        description: "Record and review donations",
      },
      {
        name: "Communications",
        url: "/communications",
        description: "Build campaigns and manage outreach",
      },
      {
        name: "Steward AI",
        url: "/steward-ai-workspace",
        description: "Open AGENTSteward workspace",
      },
    ],
  };
}
