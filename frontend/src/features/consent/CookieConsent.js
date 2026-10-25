'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useConsent } from '@/providers/ConsentProvider';
import styles from './CookieConsent.module.css';

// The cookie choice, asked once and reachable again from "Cookie settings" in the footer.
// Both buttons are equally easy to press; "Accept all" is marked as recommended because it is what
// makes the college suggestions personal — the page says plainly what that means and that
// declining loses nothing else.
export default function CookieConsent() {
  const { ready, open, consent, choose } = useConsent();
  const heading = useRef(null);

  // Reopened from the footer: move focus to the card so keyboard users land on the choice.
  useEffect(() => { if (open && consent !== null) heading.current?.focus(); }, [open, consent]);

  if (!ready || !open) return null;
  return <section className={styles.card} role="region" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-text">
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3.5 3.5 3 3 0 0 0 2.5 2.5Z" />
        <path d="M8.5 9.5h.01M15.5 14.5h.01M10 15.5h.01M12 11h.01" strokeWidth="2.6" />
      </svg>
    </span>
    <div className={styles.copy}>
      <h2 id="cookie-consent-title" className={styles.title} ref={heading} tabIndex={-1}>We value your privacy</h2>
      <p id="cookie-consent-text" className={styles.text}>
        Essential cookies keep you signed in and the site secure. With your permission we also remember what you search and
        open, so we can recommend colleges that fit you. We never sell your data. <Link href="/cookie-policy">Cookie policy</Link>
      </p>
    </div>
    <div className={styles.actions}>
      <button type="button" className="lux-button lux-button--outline" onClick={() => choose('essential')}>Essential only</button>
      <button type="button" className={`lux-button lux-button--primary ${styles.accept}`} onClick={() => choose('all')}>
        Accept all<span className={styles.badge}>Recommended</span>
      </button>
    </div>
  </section>;
}

/** Footer link that brings the choice back. */
export function CookieSettingsButton({ className }) {
  const { reopen } = useConsent();
  return <button type="button" className={className} onClick={reopen}>Cookie settings</button>;
}
