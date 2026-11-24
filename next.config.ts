import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['@sparticuz/chromium', 'playwright', 'playwright-core'],
  outputFileTracingIncludes: {
    '/api/pdf': [
      './node_modules/@sparticuz/chromium/bin/**/*',
      './node_modules/katex/dist/**/*',
      './public/fonts/**/*',
    ],
  },
};

export default nextConfig;
