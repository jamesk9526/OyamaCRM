import type { MetadataRoute } from "next";

/** Blocks all crawler indexing for the CRM application. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
