'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from '@/features/universities/profile/Boundary.module.css';

// Profile failed to load (usually the API restarting). Server errors reach the browser only as a digest.
export default function UniversityError({ error, retry }) {
  return <main id="main" className={styles.page}>
    <div className={`lux-state ${styles.state}`} role="alert">
      <Icon name="refresh" />
      <p className="lux-eyebrow lux-eyebrow--rule">Temporarily unavailable</p>
      <h1 className="lux-display-3">We couldn’t load this profile</h1>
      <p className="lux-lead">This is usually temporary. Please try again in a moment.</p>
      <div className={styles.actions}>
        <button type="button" className="lux-button lux-button--primary" onClick={() => retry()}><Icon name="refresh" />Try again</button>
        <Link className="lux-button lux-button--ghost" href="/universities">Back to the directory</Link>
      </div>
      {error?.digest && <p className={styles.digest}>Reference {error.digest}</p>}
    </div>
  </main>;
}
