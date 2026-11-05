import type { NextConfig } from "next";
import path from "path";

const apiProxyTarget = String(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000")
  .trim()
  .replace(/[?#].*$/, "")
  .replace(/(?:\/api)+\/?$/i, "")
  .replace(/\/+$/, "");

const compassionApiTarget = (process.env.COMPASSION_API_URL || "http://127.0.0.1:4100").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Check all web code and its imports here; API and whole-repository checks
  // retain their separate commands. Avoid loading tests/seeds into this worker.
  typescript: { tsconfigPath: "tsconfig.web.json" },
  experimental: {
    cpus: 1,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  allowedDevOrigins: ["www.crm.partnertpcc.com"],
  webpack(config) {
    // Browser-safe Studio contracts also compile as Node ESM on the server.
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, ".js": [".js", ".ts", ".tsx"] };
    return config;
  },
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      scheduler: "./node_modules/scheduler/index.js",
    },
  },
  async headers() {
    return [
      // The sandboxed Studio preview has an opaque origin and uses these public print fonts.
      ...["inter-latin-variable", "noto-serif-latin"].map(font => ({
        source: `/fonts/${font}.woff2`,
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      })),
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
      // Uploaded email assets live with the API process. Proxy them through the
      // public app origin so builder previews and delivered email use the same
      // stable URL, even when web and API run on separate hosts.
      beforeFiles: [
        { source: "/.well-known/oauth-authorization-server", destination: `${apiProxyTarget}/.well-known/oauth-authorization-server` },
        { source: "/.well-known/oauth-protected-resource/:path*", destination: `${apiProxyTarget}/.well-known/oauth-protected-resource/:path*` },
        {
          source: "/uploads/email-media/:path*",
          destination: `${apiProxyTarget}/api/email-campaigns/media/:path*`,
        },
        {
          source: "/uploads/branding/:path*",
          destination: `${apiProxyTarget}/api/public-media/branding/:path*`,
        },
        {
          source: "/uploads/letter-media/:path*",
          destination: `${apiProxyTarget}/api/letters/media/:path*`,
        },
      ],
      fallback: [
        { source: "/api/compassion/:path*", destination: `${compassionApiTarget}/api/compassion/:path*` },
        { source: "/api/compassion-public/:path*", destination: `${compassionApiTarget}/api/compassion-public/:path*` },
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
