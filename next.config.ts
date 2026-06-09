import type { NextConfig } from "next";
import path from "path";

const apiProxyTarget = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["www.crm.partnertpcc.com"],
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      scheduler: "./node_modules/scheduler/index.js",
    },
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
