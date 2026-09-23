import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The board image reads its fonts off disk at request time, which file
  // tracing doesn't detect on its own. Without this they're missing from the
  // serverless bundle and the route 500s in production while working locally.
  outputFileTracingIncludes: {
    "/api/admin/board": ["./assets/**"],
  },
};

export default nextConfig;
