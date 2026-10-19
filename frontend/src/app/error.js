'use client';
import Link from 'next/link';
import StatusPage from '@/components/layout/StatusPage';
import Icon from '@/components/ui/Icon';

// Shown when a page or the site layout fails (for example the API is restarting). Server errors
// reach the browser only as a digest, which matches the server log line for support.
export default function Error({ error, retry }) {
  return <StatusPage role="alert" eyebrow="Something went wrong" title="We couldn’t load this page."
    actions={<><button type="button" className="lux-button lux-button--primary" onClick={() => retry()}><Icon name="refresh" />Try again</button><Link className="lux-button lux-button--ghost" href="/">Go to the home page</Link></>}>
    <p>This is usually temporary. Please try again in a moment.</p>
    {error?.digest && <p><small>Reference {error.digest}</small></p>}
  </StatusPage>;
}
