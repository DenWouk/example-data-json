import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // images: {
  //   domains: [], // Калі ты выкарыстоўваеш малюнкі з вонкавых даменаў, дадай іх сюды
  //   unoptimized: false,
  // },
  poweredByHeader: false,
  output: "standalone",
};

export default nextConfig;
