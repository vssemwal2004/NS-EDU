'use client';

// Last-resort page when the root layout itself fails: the global stylesheet is not loaded,
// so the Luxe palette is inlined here (ivory page, wine heading and button, oxblood ink).
const page = { margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px', background: 'radial-gradient(ellipse at 85% 0%, #F8E8E4, transparent 55%), #FFFAF5', color: '#1F1418', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif", textAlign: 'center' };

export default function GlobalError({ error, retry }) {
  return <html lang="en">
    <body style={page}>
      <title>Something went wrong | Gyaan Vidhya</title>
      <main style={{ maxWidth: '560px' }}>
        <p style={{ margin: 0, color: '#8A6249', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', fontSize: '12px' }}>Gyaan Vidhya</p>
        <h1 style={{ margin: '12px 0', color: '#72243B', fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.1 }}>Something went wrong.</h1>
        <p style={{ margin: 0, color: '#66565C', fontSize: '17px', lineHeight: 1.55 }}>Please try again in a moment.{error?.digest ? ` (Reference ${error.digest})` : ''}</p>
        <button type="button" onClick={() => retry()} style={{ marginTop: '24px', minHeight: '48px', padding: '0 24px', border: 0, borderRadius: '999px', background: '#72243B', color: '#FFFFFF', font: 'inherit', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
      </main>
    </body>
  </html>;
}
