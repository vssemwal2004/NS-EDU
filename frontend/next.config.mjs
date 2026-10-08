const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.indianexpress.com' },
      { protocol: 'https', hostname: 'www.hindustantimes.com', pathname: '/ht-img/**' },
      { protocol: 'https', hostname: 'etimg.etb2bimg.com' },
      { protocol: 'https', hostname: 'education.economictimes.indiatimes.com' },
    ],
  },
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${process.env.API_URL || 'http://127.0.0.1:4100'}/api/:path*`,
    }];
  },
};
export default nextConfig;
