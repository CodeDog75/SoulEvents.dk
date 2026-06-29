import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  typedRoutes: false,
};

export default nextConfig;
