/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '15mb' },
    // @node-rs/argon2 ships native .node binaries; we must not let webpack
    // try to bundle them. Marking it external makes Next.js leave a
    // require() call that resolves to the right prebuilt binary at runtime
    // (glibc on Vercel/Lambda, musl on Alpine, darwin on macOS, etc.).
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

module.exports = nextConfig;
