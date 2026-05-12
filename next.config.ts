import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["www.crm.partnertpcc.com"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
