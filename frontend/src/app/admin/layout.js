export const metadata = {
  title: { default: 'Admin console | NSEDU', template: '%s | NSEDU Admin' },
  robots: { index: false, follow: false },
};

// The admin area has its own chrome; it never renders the public header, footer or student session.
export default function AdminRootLayout({ children }) {
  return children;
}
