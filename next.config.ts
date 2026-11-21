import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 10.100.102.5 = this Mac on the home Wi-Fi, so the phone can open the dev
  // server. If the Mac's Wi-Fi address changes, update it here.
  allowedDevOrigins: ["127.0.0.1", "10.100.102.5"],
  // Next 16.3 + Vercel's adapter skips next-server.js.nft.json when standalone
  // is on; Vercel ignores standalone anyway. Keep it for Docker / self-host.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    turbopackMinify: false,
  },
};

export default nextConfig;
