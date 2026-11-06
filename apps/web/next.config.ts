import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Enable src/instrumentation.ts production env checks
  // (Next.js loads this automatically when the file exists)
};

export default nextConfig;
