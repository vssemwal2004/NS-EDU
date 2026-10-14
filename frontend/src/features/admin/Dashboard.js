'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { ColumnChart, RankedBars } from './BarChart';
import styles from './Dashboard.module.css';

const dayShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };

const quickActions = [
  { label: 'Add college', href: '/admin/institutions?new=1', icon: 'building' },
  { label: 'Add programme', href: '/admin/programmes?new=1', icon: 'layers' },
  { label: 'Add course', href: '/admin/courses?new=1', icon: 'book' },
  { label: 'Review students', href: '/admin/students', icon: 'people' },
];

export default function Dashboard() {
  const { admin, request } = useAdminSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request('/dashboard', { signal: controller.signal }).then(setData).catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [request]);

  if (error) return <div className={styles.errorCard} role="alert"><Icon name="shield" /><p>{error}</p><button type="button" className="button button--outline" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!data) return <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading dashboard">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>;

  const { counts } = data;
  const tiles = [
    { label: 'Students', value: counts.students, note: `+${counts.newStudents7d} in the last 7 days`, icon: 'people', href: '/admin/students' },
    { label: 'Colleges', value: counts.institutions, note: `${counts.programmes} programmes`, icon: 'building', href: '/admin/institutions' },
    { label: 'Courses', value: counts.courses, note: `${counts.exams} exam guides`, icon: 'book', href: '/admin/courses' },
    { label: 'Locations', value: counts.cities + counts.states, note: `${counts.cities} cities · ${counts.states} states`, icon: 'map', href: '/admin/cities' },
  ];
  const days = data.studentsByDay.map((item) => ({ label: item.date, value: item.count }));
  const signups14 = days.reduce((sum, item) => sum + item.value, 0);
  const byCourse = [...data.programmesByCourse].sort((a, b) => b.count - a.count).slice(0, 8).map((item) => ({ label: item.courseName || item.courseId, value: item.count }));
  const formatDay = (item, size) => (size === 'short' ? dayShort : dayLong).format(new Date(`${item.label}T00:00:00Z`));

  return <div className={styles.dashboard}>
    <section className={styles.welcome}>
      <div>
        <p className={styles.welcomeEyebrow}>{dayLong.format(new Date())}</p>
        <h2>{greeting()}, {admin?.name || 'Admin'}.</h2>
        <p>{counts.newStudents7d ? `${counts.newStudents7d} new ${counts.newStudents7d === 1 ? 'student' : 'students'} joined this week.` : 'No new student sign-ups this week yet.'} Keep the catalogue accurate — changes publish to students immediately.</p>
      </div>
      <nav className={styles.quickActions} aria-label="Quick actions">{quickActions.map((action) => <Link key={action.href} href={action.href}><Icon name={action.icon} />{action.label}</Link>)}</nav>
    </section>

    <section className={styles.tiles} aria-label="Key figures">
      {tiles.map((tile) => <Link key={tile.label} href={tile.href} className={styles.tile}>
        <span className={styles.tileIcon}><Icon name={tile.icon} /></span>
        <span className={styles.tileLabel}>{tile.label}</span>
        <strong className={styles.tileValue}>{tile.value.toLocaleString('en-IN')}</strong>
        <span className={styles.tileNote}>{tile.note}</span>
      </Link>)}
    </section>

    <div className={styles.row}>
      <section className={styles.card} aria-labelledby="signups-title">
        <header className={styles.cardHeader}>
          <div><h3 id="signups-title">New students</h3><p>Last 14 days · {signups14} sign-ups</p></div>
          <button type="button" className={styles.linkButton} onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>{showTable ? 'Show chart' : 'View as table'}</button>
        </header>
        {showTable
          ? <table className={styles.table}><thead><tr><th scope="col">Date</th><th scope="col">New students</th></tr></thead><tbody>{days.map((item) => <tr key={item.label}><td>{formatDay(item, 'long')}</td><td>{item.value}</td></tr>)}</tbody></table>
          : <ColumnChart data={days} label="New student sign-ups per day for the last 14 days" formatLabel={formatDay} />}
      </section>
      <section className={styles.card} aria-labelledby="programmes-title">
        <header className={styles.cardHeader}><div><h3 id="programmes-title">Programmes by course</h3><p>{counts.programmes} programmes across {data.programmesByCourse.length} courses</p></div><Link className={styles.linkButton} href="/admin/programmes">Manage</Link></header>
        {byCourse.length ? <RankedBars data={byCourse} total={counts.programmes} /> : <p className={styles.muted}>No programmes yet.</p>}
      </section>
    </div>

    <div className={styles.row}>
      <section className={styles.card} aria-labelledby="recent-title">
        <header className={styles.cardHeader}><div><h3 id="recent-title">Recent student activity</h3><p>Latest sign-ins</p></div><Link className={styles.linkButton} href="/admin/students">All students</Link></header>
        {data.recentStudents.length ? <table className={styles.table}>
          <thead><tr><th scope="col">Student</th><th scope="col">Last sign-in</th><th scope="col">Status</th></tr></thead>
          <tbody>{data.recentStudents.map((student) => <tr key={student.id}>
            <td><strong>{student.name || 'Unnamed student'}</strong><small>{student.email || student.phone}</small></td>
            <td>{student.lastLoginAt ? dateTime.format(new Date(student.lastLoginAt)) : '—'}</td>
            <td><span className={styles.status} data-status={student.status}>{student.status === 'blocked' ? 'Blocked' : 'Active'}</span></td>
          </tr>)}</tbody>
        </table> : <div className={styles.emptyState}><Icon name="people" /><p>No students have signed in yet. They appear here after their first one-time-code login.</p></div>}
      </section>
      <section className={styles.card} aria-labelledby="health-title">
        <header className={styles.cardHeader}><div><h3 id="health-title">Platform overview</h3><p>Records managed in this console</p></div></header>
        <dl className={styles.health}>
          {[
            ['Active students', counts.activeStudents, 'people'], ['Blocked students', counts.blockedStudents, 'lock'],
            ['Exam guides', counts.exams, 'document'], ['Scholarships', counts.scholarships, 'cap'],
            ['Cities', counts.cities, 'location'], ['States', counts.states, 'map'],
          ].map(([label, value, icon]) => <div key={label}><dt><Icon name={icon} />{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
  </div>;
}
