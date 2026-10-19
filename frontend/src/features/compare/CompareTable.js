'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatSalary, formatTuition } from '@/lib/college-catalog';
import { universityOf } from './CompareArena';
import { MAX, bestIds } from './compare-data';
import styles from './Table.module.css';

const unique = (values) => [...new Set(values.filter(Boolean))];

function buildSections(course, stats, selected) {
  const allSalaryMissing = selected.every((row) => row.medianSalaryLpa == null && row.highestSalaryLpa == null);
  const placementYears = unique(selected.map((row) => row.placementYear)).join(', ');
  return [
    { id: 'compare-overview', title: 'Overview', icon: 'location', caption: 'Demo ratings are sample values for this preview, not student reviews.', rows: [
      { label: 'Location', same: (row) => `${row.city}|${row.state}`, render: (row) => <><span className={styles.value}>{row.city}</span>{row.state && <small className={styles.sub}>{row.state}</small>}</> },
      { label: 'Programme', same: () => course.id, render: () => <span className={styles.plain}>{course.fullName || course.name}</span> },
      { label: 'Demo rating', metric: 'demoRating', mode: 'max', what: 'demo rating', format: (value) => `${value.toFixed(1)} / 5` },
    ] },
    { id: 'compare-fees', title: 'Fees', icon: 'wallet', caption: `${course.name} tuition listed: ${formatTuition(stats.feeMin)} – ${formatTuition(stats.feeMax)} a year across ${stats.count} colleges. Bars start at zero, scaled to the highest.`, rows: [
      { label: 'Annual tuition', hint: 'Tuition only', metric: 'annualTuitionInr', mode: 'min', what: 'tuition', bar: 'fee', scale: stats.feeMax, delta: true, format: (value) => <>{formatTuition(value)}<small> /yr</small></> },
    ] },
    { id: 'compare-placements', title: 'Placements', icon: 'trend', caption: `${placementYears ? `Placement year ${placementYears}. ` : ''}Median is the middle salary; highest is a single offer.`,
      rows: allSalaryMissing
        ? [{ label: 'Salary figures', note: 'Placement figures are not provided for these programmes.' }]
        : [
          { label: 'Median salary', metric: 'medianSalaryLpa', mode: 'max', what: 'median salary', bar: 'salary', scale: stats.medianMax, format: formatSalary },
          { label: 'Highest salary', metric: 'highestSalaryLpa', mode: 'max', what: 'highest salary', bar: 'salary', scale: stats.highestMax, format: formatSalary },
        ] },
    { id: 'compare-years', title: 'Data years', icon: 'calendar', caption: 'When each figure was collected. Older figures may have changed since.', rows: [
      { label: 'Fee data year', same: (row) => row.tuitionYear, render: (row) => <span className={styles.plain}>{row.tuitionYear || 'Not provided'}</span> },
      { label: 'Placement data year', same: (row) => row.placementYear, render: (row) => <span className={styles.plain}>{row.placementYear || 'Not provided'}</span> },
      { label: 'Data status', same: (row) => String(row.isIllustrative), render: (row) => (row.isIllustrative ? <span className={styles.tag}>Illustrative</span> : <span className={styles.plain}>Listed</span>) },
    ] },
  ];
}

function MetricCell({ row, item, best }) {
  const value = row[item.metric];
  if (value == null) return <td><span className={styles.missing}>Not provided</span></td>;
  const isBest = Boolean(best?.ids.has(row.id));
  return <td data-best={isBest || undefined}>
    <span className={styles.value}>{item.format(value)}</span>
    {item.bar && item.scale > 0 && <span className={styles.bar} data-kind={item.bar} aria-hidden="true"><span style={{ width: `${Math.min(100, (value / item.scale) * 100)}%` }} /></span>}
    {isBest && <span className={styles.badge}><Icon name="compareTrophy" />{item.mode === 'min' ? 'Lowest' : 'Highest'}<span className="sr-only"> {item.what} among selected</span></span>}
    {!isBest && item.delta && best && <small className={styles.delta}>+{formatTuition(value - best.target)} vs lowest</small>}
  </td>;
}

// A real <table> on every screen. Column heads stick under the site header; on phones each metric label
// spans the row and the values sit side by side beneath it, so up to three colleges fit without sideways scrolling.
export default function CompareTable({ course, stats, selected, highlight }) {
  const sections = buildSections(course, stats, selected);
  const compare = highlight && selected.length > 1;

  return <div className={styles.shell} role="region" aria-label={`${course.name} comparison table`}>
    <table className={styles.table} data-highlight={compare || undefined} style={{ '--cols': selected.length }}>
      <caption className="sr-only">{course.name} comparison of {selected.map((row) => row.name).join(', ')}. Illustrative data; Lowest and Highest compare only the selected colleges.</caption>
      <thead>
        <tr>
          <td className={styles.corner}><span>{course.name}</span><small>{selected.length} of {MAX} · Illustrative</small></td>
          {selected.map((row, index) => <th key={row.id} scope="col">
            <span className={styles.head}>
              <span className={styles.headArt} aria-hidden="true"><CollegeArtwork row={row} className={styles.headThumb} /><i>{index + 1}</i></span>
              <span className={styles.headText}><strong aria-hidden="true">{row.shortName || row.name}</strong><span className="sr-only">{row.name}</span><small>{row.city}</small></span>
            </span>
          </th>)}
        </tr>
      </thead>
      {sections.map((section) => <tbody key={section.id} id={section.id} className={styles.group}>
        <tr className={styles.sectionRow}>
          <th scope="rowgroup" colSpan={selected.length + 1}>
            <span className={styles.sectionHead}>
              <span className={styles.sectionIcon}><Icon name={section.icon} /></span>
              <span><span className={styles.sectionTitle}>{section.title}</span><small>{section.caption}</small></span>
            </span>
          </th>
        </tr>
        {section.rows.map((item) => {
          if (item.note) return <tr key={item.label}><th scope="row">{item.label}</th><td colSpan={selected.length}><span className={styles.missing}>{item.note}</span></td></tr>;
          const key = item.same || ((row) => String(row[item.metric]));
          const same = selected.every((row) => key(row) === key(selected[0]));
          const best = item.metric && selected.length > 1 ? bestIds(selected, item.metric, item.mode) : null;
          return <tr key={item.label} data-diff={compare ? (same ? 'same' : 'differs') : undefined}>
            <th scope="row"><span className={styles.rowLabel}>{item.label}{item.hint && <small>{item.hint}</small>}</span>{compare && same && <span className={styles.sameTag}>Same for all</span>}</th>
            {selected.map((row) => (item.metric
              ? <MetricCell key={row.id} row={row} item={item} best={best} />
              : <td key={row.id}>{item.render(row)}</td>))}
          </tr>;
        })}
      </tbody>)}
      <tbody className={styles.next}>
        <tr>
          <th scope="row"><span className={styles.rowLabel}>Next step<small>Quick apply takes a minute</small></span></th>
          {selected.map((row) => <td key={row.id}>
            <ApplyButton university={universityOf(row)} courseSlug={course.id} block className={styles.apply}>Apply<span className="sr-only"> to {row.name}</span><Icon name="arrow" /></ApplyButton>
            <Link className={styles.view} href={`/universities/${row.collegeId}`}>View college<span className="sr-only">: {row.name}</span></Link>
          </td>)}
        </tr>
      </tbody>
    </table>
  </div>;
}
