import '@/styles/index.css';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = {
  title: 'NSEDU — Find a college that fits your future',
  description: 'Explore colleges, courses and career paths across India. Make a thoughtful choice with NSEDU.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/dm-serif-display-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body id="top">{children}<SiteFooter /></body>
    </html>
  );
}
