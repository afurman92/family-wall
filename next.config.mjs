/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // beforeFiles so the SPA wins over the legacy /frame/[token] page route.
    // The SPA reads its token from the /frame/<token> path it was served at.
    return {
      beforeFiles: [{ source: "/frame/:token", destination: "/app/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
