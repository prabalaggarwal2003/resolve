/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { 
        source: '/api/:path*', 
        destination: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:4000/api/:path*'
          : 'https://resolve-backend-77vy.onrender.com/api/:path*' 
      },
    ];
  },
};

module.exports = nextConfig;
