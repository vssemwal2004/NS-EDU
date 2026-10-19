'use client';

// Last-resort page when the root layout itself fails; it cannot rely on the global stylesheet.
export default function GlobalError({ error, retry }) {
  return <html lang="en">
    <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FFFAF8', color: '#2B1A20', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px' }}>
      <title>Something went wrong | Gyaan Vidhya</title>
      <main>
        <p style={{ color: '#72243B', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontSize: '12px' }}>Gyaan Vidhya</p>
        <h1 style={{ fontSize: '28px', margin: '8px 0' }}>Something went wrong.</h1>
        <p style={{ color: '#6B5A60' }}>Please try again in a moment.{error?.digest ? ` (Reference ${error.digest})` : ''}</p>
        <button type="button" onClick={() => retry()} style={{ marginTop: '16px', minHeight: '44px', padding: '0 20px', border: 0, borderRadius: '12px', background: '#72243B', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>Try again</button>
      </main>
    </body>
  </html>;
}
