'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import styles from './Home.module.css';

// Every figure is counted from the catalogue at render time (admin edits flow through).
export default function StatStrip() {
  const { courses, colleges, exams, cityNames, stateNames, stats: totals } = useCatalog();
  const universities = totals?.institutions ?? new Set(colleges.map((row) => row.collegeId)).size;
  const stats = [
    { value: new Intl.NumberFormat('en-IN').format(universities), label: 'universities & colleges', action: 'search the university directory', href: '/universities', icon: 'building' },
    { value: courses.length, label: 'courses', action: 'browse courses', href: '/courses', icon: 'book' },
    { value: colleges.length, label: 'programmes with fees', action: 'compare fees and placements', href: '/colleges', icon: 'cap' },
    { value: exams.length, label: 'exam guides', action: 'open exam guides', href: '/exams', icon: 'document' },
    { value: cityNames.length + stateNames.length, label: 'cities & states', action: 'browse destinations', href: '/locations', icon: 'location' },
  ];
  return <section className={styles.stats} aria-labelledby="home-stats-title">
    <div className={`container ${styles.statsInner}`}>
      <div className={styles.statsIntro}>
        <h2 id="home-stats-title">At a glance</h2>
        <p>Fee and placement figures are illustrative until verified. <Link href="/sources-and-editorial">How we use sources</Link></p>
      </div>
      <ul className={styles.statList}>
        {stats.map((stat) => <li key={stat.label}>
          <Link href={stat.href} aria-label={`${stat.value} ${stat.label} — ${stat.action}`}>
            <span className={styles.statIcon}><Icon name={stat.icon} /></span>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </section>;
}
