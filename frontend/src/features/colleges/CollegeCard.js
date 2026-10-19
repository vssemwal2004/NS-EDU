'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatSalary, formatTuition, placeName, summarize } from '@/lib/college-catalog';
import { compareHref } from './compareStore';
import styles from './Ledger.module.css';

const PREVIEW = 3;

// One ledger entry per institution: a programme-by-programme table of tuition (with a bar) and packages.
export default function CollegeCard({ group, index, courseById, focusCourse, feeScale, compare, onToggle, notice }) {
  const [open, setOpen] = useState(false);
  const { rows } = group;
  const summary = summarize(rows);
  const href = `/universities/${group.id}`;
  const titleId = `college-${group.id}`;
  const lines = open ? rows : rows.slice(0, PREVIEW);
  const courseName = (row) => courseById.get(row.courseId)?.name || row.courseId;
  const applyCourse = rows.some((row) => row.courseId === focusCourse) ? focusCourse : rows.length === 1 ? rows[0].courseId : undefined;
  const budgetId = applyCourse || rows[0].courseId;
  const picked = rows.filter((row) => compare.has(row.id)).length;

  return <article id={`card-${group.id}`} className={styles.entry} aria-labelledby={titleId} tabIndex={-1} data-selected={picked > 0 || undefined}>
    <div className={styles.entryHead}>
      <span className={styles.entryNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true"><CollegeArtwork row={group} className={styles.thumbArt} /></Link>
      <div className={styles.entryTitle}>
        <h3 id={titleId}><Link href={href}>{group.name}</Link></h3>
        <p>
          <span><Icon name="location" />{placeName(group)}</span>
          {group.demoRating != null && <span><Icon name="star" />{group.demoRating.toFixed(1)}<small> / 5 demo rating</small></span>}
        </p>
      </div>
    </div>

    <table className={styles.lines}>
      <caption className="sr-only">Programmes at {group.name}: annual tuition and placement figures</caption>
      <thead>
        <tr><th scope="col">Programme</th><th scope="col">Annual tuition</th><th scope="col">Median package</th><th scope="col"><span className="sr-only">Compare</span></th></tr>
      </thead>
      <tbody>
        {lines.map((row) => {
          const pressed = compare.has(row.id);
          const share = feeScale > 0 && Number.isFinite(row.annualTuitionInr) ? Math.min(100, (row.annualTuitionInr / feeScale) * 100) : 0;
          return <tr key={row.id} data-selected={pressed || undefined} data-focus={row.courseId === focusCourse || undefined}>
            <th scope="row"><span className={styles.lineName}>{courseName(row)}</span><small>Fees {row.tuitionYear || 'year not stated'}</small></th>
            <td className={styles.feeCell}>
              <span className={styles.amount}>{formatTuition(row.annualTuitionInr)}<small>/yr</small></span>
              <span className={styles.feeBar} aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
            </td>
            <td className={styles.payCell}>
              <span className={styles.amount} data-missing={row.medianSalaryLpa == null || undefined}>{formatSalary(row.medianSalaryLpa)}</span>
              {row.highestSalaryLpa != null && <small>Highest ₹{row.highestSalaryLpa} LPA · {row.placementYear}</small>}
            </td>
            <td className={styles.pickCell}>
              <button type="button" className={styles.pick} aria-pressed={pressed} onClick={() => onToggle(row)}>
                <Icon name={pressed ? 'check' : 'compare'} />{pressed ? 'Added' : 'Compare'}<span className="sr-only"> {group.shortName} {courseName(row)}</span>
              </button>
            </td>
          </tr>;
        })}
      </tbody>
    </table>
    {rows.length > PREVIEW && <button type="button" className={styles.moreLines} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? 'Show fewer programmes' : `+${rows.length - PREVIEW} more ${rows.length - PREVIEW === 1 ? 'programme' : 'programmes'}`}<Icon name="chevron" />
    </button>}

    <div className={styles.entryFoot}>
      <p className={styles.entrySum}>
        {rows.length > 1 ? <>{rows.length} programmes · {formatTuition(summary.feeMin)} – {formatTuition(summary.feeMax)}</> : <>1 programme listed</>}
        {summary.highestMax != null && <> · top offer ₹{summary.highestMax} LPA</>}
      </p>
      <div className={styles.entryActions}>
        <Link className="lux-link" href={href}>View university<span className="sr-only">: {group.name}</span><Icon name="arrow" /></Link>
        <Link className="lux-link" href={`/budget?course=${budgetId}`}><Icon name="wallet" />Budget<span className="sr-only"> for {courseById.get(budgetId)?.name}</span></Link>
        <ApplyButton university={{ id: group.id, name: group.name, city: group.city, state: group.state }} courseSlug={applyCourse} size="md" />
      </div>
    </div>
    {notice && <p className={styles.notice} data-full={notice.full || undefined}><Icon name="collegesInfo" />{notice.text}{notice.full && <> <Link href={compareHref(notice.courseId)}>Review your picks</Link></>}</p>}
  </article>;
}
