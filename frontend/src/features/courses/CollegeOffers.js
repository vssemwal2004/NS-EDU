'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import { COMPARE_MAX, compareHref, useCompare } from '@/features/colleges/compareStore';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { usePreferences } from '@/providers/PreferencesProvider';
import { formatLakh, formatLpa } from './data';
import styles from './CollegeOffers.module.css';

// Curated (illustrative) programme rows for one course: profile link, figures, quick apply and compare picks.
export default function CollegeOffers({ course, rows }) {
  const { setCourse } = usePreferences();
  const compare = useCompare(rows);
  const [message, setMessage] = useState('');
  const picked = (compare.lists[course.id] || []).map((row) => row.id);

  function toggle(row) {
    const result = compare.toggle(row);
    if (result === 'full') setMessage(`You can compare up to ${COMPARE_MAX} colleges. Remove one to add another.`);
    else if (result === 'removed') setMessage(`${row.shortName} removed from comparison.`);
    else { setCourse(course.id); setMessage(`${row.shortName} added to comparison (${picked.length + 1} of ${COMPARE_MAX}).`); }
  }

  return <div className={styles.wrap}>
    <ol className={styles.list}>{rows.map((row) => {
      const selected = picked.includes(row.id);
      return <li key={row.id} className={styles.offer}>
        <CollegeArtwork row={row} className={styles.thumb} />
        <div className={styles.who}>
          <h3 className={styles.name}><Link href={`/universities/${row.collegeId}`}>{row.name}</Link></h3>
          <p className={styles.place}><Icon name="location" />{[row.city, row.state].filter(Boolean).join(', ')}</p>
        </div>
        <dl className={styles.figures}>
          <div><dt>Tuition / year</dt><dd>{formatLakh(row.annualTuitionInr)}<small>fees {row.tuitionYear}</small></dd></div>
          <div><dt>Median salary</dt><dd data-empty={row.medianSalaryLpa == null || undefined}>{formatLpa(row.medianSalaryLpa)}<small>placements {row.placementYear}</small></dd></div>
          <div><dt>Demo rating</dt><dd>{row.demoRating != null ? <><span className={styles.star}><Icon name="star" />{row.demoRating.toFixed(1)}</span><small>sample only</small></> : '—'}</dd></div>
        </dl>
        <div className={styles.actions}>
          <ApplyButton university={{ id: row.collegeId, name: row.name, city: row.city, state: row.state, logoUrl: row.logoUrl }} courseSlug={course.id} className="lux-button--sm" />
          <button type="button" className={styles.compare} aria-pressed={selected} onClick={() => toggle(row)}>
            <Icon name={selected ? 'check' : 'plus'} />{selected ? 'Added' : 'Compare'}<span className="sr-only"> {row.name}</span>
          </button>
        </div>
      </li>;
    })}</ol>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>
    {picked.length > 0 && <div className={styles.tray}>
      <span>{picked.length} of {COMPARE_MAX} selected for comparison</span>
      {picked.length >= 2 ? <Link className="lux-button lux-button--light lux-button--sm" href={compareHref(course.id, picked)} onClick={() => setCourse(course.id)}>Compare {picked.length} now<Icon name="arrow" /></Link>
        : <span className={styles.trayHint}>Pick one more to compare</span>}
    </div>}
  </div>;
}
