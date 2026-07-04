import type { NextConfig } from "next";

const apiTarget = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${apiTarget}/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
