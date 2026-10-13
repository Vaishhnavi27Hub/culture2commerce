import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The e2e test uses its own build folder so it can run while `npm run dev` is open.
  distDir: process.env.C2C_DIST_DIR || ".next",
  // The parent user folder has its own lockfiles/git repo; pin the root to this project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
