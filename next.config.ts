import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The parent user folder has its own lockfiles/git repo; pin the root to this project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
