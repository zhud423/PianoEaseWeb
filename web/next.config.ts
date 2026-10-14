import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PGlite as a Node external package to avoid webpack runtime URL/path issues in route handlers.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
