const nextConfig = {
  output: 'export',

  // Dev-only: `next dev` has no nginx, so proxy /v1 to a locally running backend.
  // `next build` ignores rewrites when exporting (it warns, it does not fail) --
  // in production nginx serves this path instead. Keeping the same relative URL
  // in both environments avoids needing a build-time API base URL.
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://localhost:8080/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
