import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import styles from './StatusPage.module.css';

// Full-page state for not-found and error boundaries. These render outside the site layout,
// so the page carries its own logo and a few safe ways back.
export default function StatusPage({ mark, eyebrow, title, children, actions, role }) {
  return <main id="main" className={styles.page} role={role}>
    <div className={styles.card}>
      <Link href="/" className={styles.brand} aria-label="Gyaan Vidhya home"><Brand /></Link>
      {mark && <p className={styles.mark} aria-hidden="true">{mark}</p>}
      <p className="lux-eyebrow lux-eyebrow--rule">{eyebrow}</p>
      <h1 className="lux-display-2">{title}</h1>
      <div className={`lux-lead ${styles.text}`}>{children}</div>
      <div className={styles.actions}>{actions}</div>
      <nav className={styles.links} aria-label="Popular pages">
        <Link href="/courses">Courses</Link><Link href="/exams">Exam guides</Link><Link href="/scholarships">Scholarships</Link><Link href="/help">Help centre</Link>
      </nav>
    </div>
  </main>;
}
