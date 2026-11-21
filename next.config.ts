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
  async rewrites() {
    return {
      // `beforeFiles` supaya menang atas berkas statis di public/. Foto yang
      // diunggah setelah build tidak ada di snapshot statis, jadi harus lewat
      // route yang membaca disk per permintaan.
      beforeFiles: [{ source: "/uploads/participants/:file", destination: "/api/foto/:file" }],
      afterFiles: [],
      fallback: [],
    };
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
