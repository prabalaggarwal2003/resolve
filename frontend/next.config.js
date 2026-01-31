/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'https://resolve-backend-77vy.onrender.com/api/:path*' },
    ];
  },
};

module.exports = nextConfig;
