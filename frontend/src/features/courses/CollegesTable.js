'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { COMPARE_MAX as MAX, compareHref, useCompare } from '@/features/colleges/compareStore';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatSalary, formatTuition } from '@/lib/college-catalog';
import { usePreferences } from '@/providers/PreferencesProvider';
import styles from './Detail.module.css';

const COLUMNS = [
  { key: 'annualTuitionInr', label: 'Annual tuition', first: 'asc' },
  { key: 'medianSalaryLpa', label: 'Median salary', first: 'desc' },
  { key: 'highestSalaryLpa', label: 'Highest salary', first: 'desc' },
  { key: 'demoRating', label: 'Demo rating', first: 'desc' },
];
const SORT_OPTIONS = [
  { value: '', label: 'Catalogue order' },
  { value: 'annualTuitionInr:asc', label: 'Tuition: low to high' },
  { value: 'annualTuitionInr:desc', label: 'Tuition: high to low' },
  { value: 'medianSalaryLpa:desc', label: 'Median salary: high to low' },
  { value: 'highestSalaryLpa:desc', label: 'Highest salary: high to low' },
  { value: 'demoRating:desc', label: 'Demo rating: high to low' },
];

export default function CollegesTable({ course, rows }) {
  const { setCourse } = usePreferences();
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [message, setMessage] = useState('');
  // Shared with /colleges and /compare: localStorage 'nsedu:compare' = { [courseId]: [programmeId] }, max 3.
  const compare = useCompare(rows);
  const selected = (compare.lists[course.id] || []).map((row) => row.id);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    // Missing values (e.g. salary not reported) always sort last.
    return rows.toSorted((a, b) => {
      const x = a[sort.key]; const y = b[sort.key];
      if (x == null || y == null) return (x == null) - (y == null);
      return sort.dir === 'asc' ? x - y : y - x;
    });
  }, [rows, sort]);

  function toggleSort(column) {
    setSort((current) => current.key === column.key ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key: column.key, dir: column.first });
  }
  function toggleCompare(row) {
    const result = compare.toggle(row);
    if (result === 'full') setMessage(`You can compare up to ${MAX} colleges. Remove one to add another.`);
    else if (result === 'removed') setMessage(`${row.shortName} removed from comparison.`);
    else { setCourse(course.id); setMessage(`${row.shortName} added to comparison (${selected.length + 1} of ${MAX}).`); }
  }

  return <div className={styles.tableBlock}>
    <div className={styles.tableTools}>
      <p className={styles.tableCount}><strong>{rows.length}</strong> sample {rows.length === 1 ? 'college' : 'colleges'} · fees {rows[0]?.tuitionYear} · placements {rows[0]?.placementYear}</p>
      <label className={styles.tableSort}><span>Sort</span>
        <select value={sort.key ? `${sort.key}:${sort.dir}` : ''} onChange={(event) => { const [key = '', dir = 'asc'] = event.target.value.split(':'); setSort({ key, dir }); }}>
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select><Icon name="chevron" />
      </label>
    </div>
    <table className={styles.table}>
      <caption className="sr-only">Sample colleges offering {course.name} — illustrative data. Column headers with buttons can be sorted.</caption>
      <thead><tr>
        <th scope="col">College</th>
        {COLUMNS.map((column) => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
          <button type="button" onClick={() => toggleSort(column)}>{column.label}<Icon name={sort.key !== column.key ? 'coursesSort' : sort.dir === 'asc' ? 'coursesSortUp' : 'coursesSortDown'} /></button>
        </th>)}
        <th scope="col"><span className="sr-only">Compare</span></th>
      </tr></thead>
      <tbody>{sorted.map((row) => {
        const picked = selected.includes(row.id);
        return <tr key={row.id}>
          <th scope="row" className={styles.collegeCell}>
            <CollegeArtwork row={row} className={styles.thumb} />
            <span><Link href={`/colleges/${row.collegeId}`}>{row.name}</Link><small><Icon name="location" />{[row.city, row.state].filter(Boolean).join(', ')}</small></span>
          </th>
          <td data-label="Annual tuition"><strong>{formatTuition(row.annualTuitionInr)}</strong><small>per year · {row.tuitionYear}</small></td>
          <td data-label="Median salary" data-empty={row.medianSalaryLpa == null || undefined}>{row.medianSalaryLpa == null ? 'Not reported' : formatSalary(row.medianSalaryLpa)}</td>
          <td data-label="Highest salary" data-empty={row.highestSalaryLpa == null || undefined}>{row.highestSalaryLpa == null ? 'Not reported' : formatSalary(row.highestSalaryLpa)}</td>
          <td data-label="Demo rating"><span className={styles.rating}><Icon name="star" />{row.demoRating.toFixed(1)}</span><small>demo</small></td>
          <td className={styles.compareCell}>
            <button type="button" className={styles.compareToggle} aria-pressed={picked} onClick={() => toggleCompare(row)}>
              <Icon name={picked ? 'check' : 'plus'} />{picked ? 'Added' : 'Compare'}<span className="sr-only"> {row.name}</span>
            </button>
          </td>
        </tr>;
      })}</tbody>
    </table>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>
    {(message || selected.length > 0) && <div className={styles.compareBar}>
      <span aria-hidden={Boolean(message) || undefined}>{message || `${selected.length} of ${MAX} selected for comparison.`}</span>
      {selected.length >= 2 && <Link className="text-link" href={compareHref(course.id, selected)} onClick={() => setCourse(course.id)}>Compare {selected.length} now<Icon name="arrow" /></Link>}
    </div>}
  </div>;
}
