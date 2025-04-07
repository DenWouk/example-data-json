import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

//   webpack: (config, { isServer }) => {
//     if (!isServer) {
//       config.module.rules.push({
//         test: /\.json$/,
//         use: "json-loader",
//       });
//     }

//     return config;
//   },
};

export default nextConfig;
