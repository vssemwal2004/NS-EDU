import { fileURLToPath } from 'node:url';

const isDev = process.env.NODE_ENV === 'development';

// No nonces: most public pages are statically generated or cached, which nonces would rule out.
// Remote logos come from many official university sites, so images allow any https source.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  // Admin media uploads go straight from the browser to Cloudinary.
  `connect-src 'self' https://api.cloudinary.com${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Self-contained server bundle for the Docker image (see frontend/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  images: {
    remotePatterns: [
      // Site images and media-library uploads (see backend/src/scripts/migrate-images.js).
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.indianexpress.com' },
      { protocol: 'https', hostname: 'www.hindustantimes.com', pathname: '/ht-img/**' },
      { protocol: 'https', hostname: 'etimg.etb2bimg.com' },
      { protocol: 'https', hostname: 'education.economictimes.indiatimes.com' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Long-lived caching for the versioned brand assets.
      { source: '/brand/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
    ];
  },
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${process.env.API_URL || 'http://127.0.0.1:4100'}/api/:path*`,
    }];
  },
};
export default nextConfig;
