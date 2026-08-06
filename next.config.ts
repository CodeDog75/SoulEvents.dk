import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/public/**",
        port: "54321",
        protocol: "http",
      },
      {
        hostname: "localhost",
        pathname: "/storage/v1/object/public/**",
        port: "54321",
        protocol: "http",
      },
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [
            {
              hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
              pathname: "/storage/v1/object/public/**",
              protocol: "https" as const,
            },
          ]
        : []),
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  typedRoutes: false,
};

export default nextConfig;
