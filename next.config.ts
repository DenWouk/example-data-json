import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "local-origin.dev",
    "*.local-origin.dev",
  ],

  // images: {
  //   domains: ["wolfdev.pro", "localhost"],

  //   unoptimized: true,
  // },

  // outputFileTracingRoot: process.cwd(),
  // outputFileTracingIncludes: {
  //   "/": ["public/**/*"],
  // },

  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
};

export default nextConfig;
