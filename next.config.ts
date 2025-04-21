import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

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
