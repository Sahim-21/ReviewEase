import type { NextConfig } from "next";
import path from "path";

const API_ORIGIN = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    // Same-origin proxy for staff calls, so the API's HttpOnly session cookie is first-party.
    return [{ source: "/backend/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
