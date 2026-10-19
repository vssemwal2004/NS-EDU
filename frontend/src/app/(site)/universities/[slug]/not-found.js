import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from '@/features/universities/profile/Boundary.module.css';

export default function UniversityNotFound() {
  return <main id="main" className={styles.page}>
    <div className={`lux-state ${styles.state}`}>
      <Icon name="uniCampus" />
      <p className="lux-eyebrow lux-eyebrow--rule">Not in the directory</p>
      <h1 className="lux-display-3">We couldn’t find that university</h1>
      <p className="lux-lead">The link may be out of date, or the institution may have been renamed or removed from the directory.</p>
      <div className={styles.actions}>
        <Link className="lux-button lux-button--primary" href="/universities"><Icon name="search" />Search the directory</Link>
        <Link className="lux-button lux-button--ghost" href="/report-correction">Report a problem</Link>
      </div>
    </div>
  </main>;
}
