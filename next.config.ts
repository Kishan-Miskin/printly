import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite", "bcryptjs"],
  // Enable modern optimizations
  experimental: {
    // any future flags
  },
};

export default nextConfig;
