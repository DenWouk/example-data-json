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
    remotePatterns: [
      {
        // Разрешаем загрузку с нашего собственного сервера (localhost для разработки)
        // В продакшене замени 'localhost' на твой домен
        protocol: "http", // или https, если используешь SSL локально/в проде
        hostname: "localhost",
        port: "3000", // Укажи порт твоего dev сервера
        pathname: "/api/media/**", // Разрешаем все пути внутри /api/media/
      },
      // Добавь здесь паттерн для твоего продакшн домена
      {
        protocol: "https", // Пример для продакшена
        hostname: "wolfdev.pro", // Замени на свой домен
        port: "", // Обычно порт не нужен для https
        pathname: "/api/media/**",
      },
    ],
  },

  // images: {
  //   domains: ["localhost", "wolfdev.pro"],
  //   unoptimized: true,
  //   remotePatterns: [
  //     {
  //       protocol: "http",
  //       hostname: "127.0.0.1",
  //       port: "3000",
  //       pathname: "/images/**",
  //     },
  //     {
  //       protocol: "https",
  //       hostname: "wolfdev.pro",
  //       pathname: "/images/**",
  //     },
  //   ],
  // },

  // outputFileTracingRoot: process.cwd(),
  // outputFileTracingIncludes: {
  //   "/": ["public/**/*"],
  // },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
