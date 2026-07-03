import type { NextConfig } from "next";

// Server-only (NOT NEXT_PUBLIC): the backend URL never ships to the client.
// The app calls same-origin /api; Next rewrites it to this target.
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? "https://nelva-be.up.railway.app";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
