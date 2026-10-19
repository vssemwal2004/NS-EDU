'use client';
import Link from 'next/link';

// Shown when a page or the site layout fails (for example the API is restarting). Server errors
// reach the browser only as a digest, which matches the server log line for support.
export default function Error({ error, retry }) {
  return <main className="empty-page" role="alert">
    <p className="eyebrow">Gyaan Vidhya</p>
    <h1>We couldn’t load this page.</h1>
    <p>This is usually temporary. Please try again in a moment.{error?.digest ? ` (Reference ${error.digest})` : ''}</p>
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <button type="button" className="button button--primary" onClick={() => retry()}>Try again</button>
      <Link className="button button--outline" href="/">Go to the home page</Link>
    </div>
  </main>;
}
