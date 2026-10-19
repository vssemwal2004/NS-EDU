import '@/styles/index.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const title = 'Gyaan Vidhya — Find a university that fits your future';
const description = 'Explore universities, courses and career paths across India, compare your options and apply with confidence on Gyaan Vidhya.';

// Favicon and Apple icon come from src/app/icon.png and src/app/apple-icon.png (Next file conventions).
export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: 'Gyaan Vidhya',
  manifest: '/manifest.webmanifest',
  openGraph: { title, description, siteName: 'Gyaan Vidhya', type: 'website', locale: 'en_IN', images: [{ url: '/brand/icon-512.png', width: 512, height: 512, alt: 'Gyaan Vidhya' }] },
  twitter: { card: 'summary', title, description },
};

export const viewport = { themeColor: '#72243B', width: 'device-width', initialScale: 1 };

// Root shell only. The public site and the admin console each add their own layout.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/dm-serif-display-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body id="top">{children}</body>
    </html>
  );
}
