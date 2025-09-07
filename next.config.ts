import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['corlena', '@corlena/wasm'],
  experimental: {
    esmExternals: 'loose'
  }
};

export default nextConfig;
