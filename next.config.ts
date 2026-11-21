import type { NextConfig } from "next";
import { createRequire } from "node:module";

// Loader Tailwind di-resolve ke path absolut supaya Turbopack tidak perlu
// mencari nama modul di proses worker (gagal saat NODE_ENV=production di shell).
const require = createRequire(import.meta.url);
const tailwindLoader = require.resolve("@tailwindcss/turbopack");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Route pas foto membaca `public/uploads/participants` dari disk. Turbopack
  // menelusuri direktori itu saat build dan tersandung symlink Python di
  // ocr-service/.venv (target di luar root). Berkas foto tidak perlu ditelusuri,
  // jadi dikecualikan; route membacanya per permintaan.
  outputFileTracingExcludes: {
    "*": ["./ocr-service/**", "./public/uploads/**"],
  },
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
