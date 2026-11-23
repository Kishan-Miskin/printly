import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite", "bcryptjs"],
  allowedDevOrigins: [
    "10.167.194.240",
    "10.167.194.240:3001",
    "172.16.0.2",
    "172.16.0.2:3001",
    "localhost:3000",
    "localhost:3001",
    "*.loca.lt",
  ],
};

export default nextConfig;
