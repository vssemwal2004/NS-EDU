import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { loginHref } from '@/features/auth/gated-routes';
import { formatCount } from './labels';
import styles from './PreviewGate.module.css';

// Signed-out visitors get a free preview of the directory (backend universities/free-preview.js):
// the first few results of a search and a couple of full profiles. These two blocks tell them what
// they have used and what a login unlocks. Signed-in viewers never receive `preview`, so they render nothing.

// Under the free results of a search: how many more a login unlocks.
export function LockedResults({ preview, next }) {
  if (!preview?.locked) return null;
  return <aside className={styles.locked} aria-label="More results need a free login">
    <span className={styles.icon}><Icon name="lock" /></span>
    <div className={styles.copy}>
      <strong>{formatCount(preview.locked)} more {preview.locked === 1 ? 'result' : 'results'} for this search</strong>
      <p>You are seeing the first {preview.shown} free. Log in — it is free and takes a minute — to see every university and filter by fees, approvals and NAAC grade.</p>
    </div>
    <Link className="lux-button lux-button--primary" href={loginHref(next, 'limit')}>Log in to see all<Icon name="arrow" /></Link>
  </aside>;
}

// Top of a profile a signed-out visitor is allowed to open: how many free profile views are left.
export function ViewsNotice({ preview, next }) {
  if (!preview) return null;
  const last = preview.remaining === 0;
  return <div className={styles.notice} data-last={last || undefined} role="status">
    <div className={`lux-container ${styles.noticeInner}`}>
      <Icon name={last ? 'lock' : 'spark'} />
      <p>{last
        ? <><strong>That was your last free profile.</strong> Log in to keep opening universities.</>
        : <><strong>Free preview:</strong> {preview.used} of {preview.limit} free {preview.limit === 1 ? 'profile' : 'profiles'} viewed.</>}</p>
      <Link className={styles.link} href={loginHref(next, last ? 'limit' : '')}>Log in free<Icon name="arrow" /></Link>
    </div>
  </div>;
}
