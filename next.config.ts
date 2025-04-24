import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "local-origin.dev",
    "*.local-origin.dev",
  ],

  images: {
    domains: ["localhost", "wolfdev.pro"],
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3000",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "wolfdev.pro",
        pathname: "/images/**",
      },
    ],
  },

  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/": ["public/**/*"],
  },

  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
};

export default nextConfig;
