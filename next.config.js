/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Reduce peak memory during Vercel/CI builds (avoids OOM retries).
  experimental: {
    webpackMemoryOptimizations: true,
  },
  webpack: (webpackConfig, { dev }) => {
    if (!dev) {
      // PackFileCacheStrategy "Serializing big strings" can spike memory on small builders.
      webpackConfig.cache = false;
    }
    return webpackConfig;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
    ],
  },
};

export default config;
