'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import styles from './Home.module.css';

const number = new Intl.NumberFormat('en-IN');

// Every figure is counted from the directory and catalogue at render time; a figure that is not
// available is left out rather than shown as zero.
export default function StatStrip() {
  const { courses, exams, locationTotals, stats: totals } = useCatalog();
  const stats = [
    { value: totals?.institutions, label: 'universities & colleges', action: 'search the university directory', href: '/universities', icon: 'building' },
    { value: totals?.statesWithInstitutions || locationTotals?.states, label: 'states & union territories', action: 'browse states', href: '/locations', icon: 'map' },
    { value: locationTotals?.cities, label: 'cities', action: 'browse cities', href: '/locations', icon: 'location' },
    { value: courses.length, label: 'course guides', action: 'browse courses', href: '/courses', icon: 'book' },
    { value: exams.length, label: 'entrance exam guides', action: 'open exam guides', href: '/exams', icon: 'document' },
  ].filter((stat) => stat.value > 0);
  if (!stats.length) return null;
  return <section className={styles.stats} aria-labelledby="home-stats-title">
    <div className={`container ${styles.statsInner}`}>
      <div className={styles.statsIntro}>
        <p className={styles.statsEyebrow}>At a glance</p>
        <h2 id="home-stats-title">India’s colleges, <em>in one place.</em></h2>
        <p>Counted live from the Gyaan Vidhya directory. <Link href="/sources-and-editorial">How we source it</Link></p>
      </div>
      <ul className={styles.statList}>
        {stats.map((stat) => <li key={stat.label}>
          <Link href={stat.href} aria-label={`${number.format(stat.value)} ${stat.label} — ${stat.action}`}>
            <span className={styles.statIcon}><Icon name={stat.icon} /></span>
            <strong>{number.format(stat.value)}</strong>
            <span>{stat.label}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </section>;
}
