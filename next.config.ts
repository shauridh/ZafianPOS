import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
