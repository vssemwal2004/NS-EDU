'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatSalary, formatTuition } from '@/lib/college-catalog';
import { usePreferences } from '@/providers/PreferencesProvider';
import CompareToggle from './CompareToggle';
import styles from './Profile.module.css';

// Desktop: sticky "Plan your next step" rail. Below 1100px: a bottom dock (Compare + Check budget).
export default function ProfileRail({ rows, courseNames, city }) {
  const { course: preferred } = usePreferences();
  const [chosen, setChosen] = useState('');
  const fallback = rows.some((row) => row.courseId === preferred) ? preferred : rows[0].courseId;
  const row = rows.find((item) => item.courseId === (chosen || fallback)) || rows[0];
  const name = courseNames[row.courseId]?.name || row.courseId;
  const single = rows.length === 1;

  return <>
    <aside className={styles.rail} aria-labelledby="rail-title">
      <div className={styles.railCard}>
        <p className={styles.railEyebrow}>Plan your next step</p>
        <h2 id="rail-title">Shortlist, check, estimate</h2>
        {single ? <p className={styles.railCourse}><Icon name="cap" />{name}<small>{courseNames[row.courseId]?.fullName}</small></p>
          : <label className={styles.railSelect}><span>Course</span>
            <select value={row.courseId} onChange={(event) => setChosen(event.target.value)}>
              {rows.map((item) => <option key={item.id} value={item.courseId}>{courseNames[item.courseId]?.name || item.courseId}</option>)}
            </select>
          </label>}
        <dl className={styles.railFacts}>
          <div><dt>Annual tuition <small>{row.tuitionYear}</small></dt><dd>{formatTuition(row.annualTuitionInr)}</dd></div>
          <div><dt>Median package <small>{row.placementYear}</small></dt><dd data-missing={row.medianSalaryLpa == null || undefined}>{formatSalary(row.medianSalaryLpa)}</dd></div>
        </dl>
        <CompareToggle key={row.id} row={row} courseName={name} className={styles.railToggle} />
        <ul className={styles.railLinks}>
          <li><Link href={`/eligibility?course=${row.courseId}`}><Icon name="eligibility" /><span>Check {name} eligibility</span><Icon name="arrow" /></Link></li>
          <li><Link href={`/budget?course=${row.courseId}`}><Icon name="wallet" /><span>Estimate the full cost</span><Icon name="arrow" /></Link></li>
          <li><Link href={`/colleges?location=${encodeURIComponent(city)}`}><Icon name="location" /><span>More colleges in {city}</span><Icon name="arrow" /></Link></li>
          <li><Link href={`/colleges?course=${row.courseId}`}><Icon name="building" /><span>Other {name} colleges</span><Icon name="arrow" /></Link></li>
        </ul>
      </div>
      <p className={styles.railNote}><Icon name="collegesInfo" />Illustrative institution. Confirm fees and eligibility with the college before applying.</p>
    </aside>

    <nav className={styles.dock} aria-label="College actions" data-colleges-profile-dock>
      {single ? <CompareToggle row={row} courseName={name} compact showStatus={false} className={styles.dockToggle} />
        : <a href="#courses"><Icon name="compare" />Compare courses</a>}
      <Link href={`/budget?course=${row.courseId}`}><Icon name="wallet" />Check budget</Link>
    </nav>
  </>;
}
