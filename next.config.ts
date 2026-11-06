import type { NextConfig } from "next";
import { createRequire } from "node:module";

// Loader Tailwind di-resolve ke path absolut supaya Turbopack tidak perlu
// mencari nama modul di proses worker (gagal saat NODE_ENV=production di shell).
const require = createRequire(import.meta.url);
const tailwindLoader = require.resolve("@tailwindcss/turbopack");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: [tailwindLoader],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
