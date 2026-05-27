/**
 * Next.js configuration for the standalone Oyama Letters workspace app.
 *
 * The Letters app does not run its own API server. It proxies every `/api/*`
 * request to the main OyamaCRM Express server (default http://localhost:4000)
 * so that all letter templates, generated letters, branding presets, and
 * donor CRM merge data continue to be served by a single backend.
 *
 * Override the backend by setting `NEXT_PUBLIC_API_URL` (or `OYAMA_API_URL`).
 */
import type { NextConfig } from "next";
import path from "path";

const apiProxyTarget =
  process.env.OYAMA_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
