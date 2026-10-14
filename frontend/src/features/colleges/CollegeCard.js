'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition, lpaRange, placeName, summarize } from '@/lib/college-catalog';
import { COMPARE_MAX, compareHref } from './compareStore';
import styles from './Listing.module.css';

const CHIP_PREVIEW = 3;

function Stat({ label, year, value, note }) {
  const missing = value === 'Not provided';
  return <div className={styles.stat}>
    <dt>{label}<small>{year}</small></dt>
    <dd data-missing={missing || undefined}>{value}{note && <small>{note}</small>}</dd>
  </div>;
}

export default function CollegeCard({ group, courseById, budgetCourse, compare, onToggle, notice, cardRef }) {
  const [chipsOpen, setChipsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { rows } = group;
  const summary = summarize(rows);
  const single = rows.length === 1;
  const href = `/colleges/${group.id}`;
  const titleId = `college-${group.id}`;
  const pickerId = `compare-picker-${group.id}`;
  const chips = chipsOpen ? rows : rows.slice(0, CHIP_PREVIEW);
  const selectedRows = rows.filter((row) => compare.has(row.id));
  const courseName = (row) => courseById.get(row.courseId)?.name || row.courseId;
  const tuition = single ? formatTuition(rows[0].annualTuitionInr) : `From ${formatTuition(summary.feeMin)}`;
  const tuitionNote = single ? 'per year' : `up to ${formatTuition(summary.feeMax)} · ${rows.length} programmes`;
  const reporting = summary.withPlacements;
  const medianNote = reporting && reporting < rows.length ? `${reporting} of ${rows.length} programmes report` : '';
  const budgetId = budgetCourse && rows.some((row) => row.courseId === budgetCourse) ? budgetCourse : rows[0].courseId;

  function compareButton(row, label) {
    const pressed = compare.has(row.id);
    return <button type="button" className={`button ${pressed ? 'button--primary' : 'button--outline'} ${styles.compareButton}`} aria-pressed={pressed} onClick={() => onToggle(row)}>
      <Icon name={pressed ? 'check' : 'compare'} />{label(pressed)}
    </button>;
  }

  return <article ref={cardRef} id={`card-${group.id}`} className={styles.card} aria-labelledby={titleId} tabIndex={-1} data-selected={selectedRows.length > 0 || undefined}>
    <Link href={href} className={styles.thumbLink} tabIndex={-1} aria-hidden="true"><CollegeArtwork row={group} className={styles.thumb} /></Link>
    <div className={styles.cardHead}>
      <h3 id={titleId}><Link href={href}>{group.name}</Link></h3>
      <p className={styles.meta}>
        <span><Icon name="location" />{placeName(group)}</span>
        <span className={styles.rating}><Icon name="star" /><strong>{group.demoRating.toFixed(1)}</strong><small>/ 5 demo rating</small></span>
      </p>
    </div>
    <div className={styles.cardBody}>
      <ul className={styles.programmes} aria-label={`Matching programmes at ${group.shortName}`}>
        {chips.map((row) => <li key={row.id} data-selected={compare.has(row.id) || undefined}><strong>{courseName(row)}</strong><span>{formatTuition(row.annualTuitionInr)}/yr</span></li>)}
        {rows.length > CHIP_PREVIEW && <li className={styles.chipToggle}><button type="button" aria-expanded={chipsOpen} onClick={() => setChipsOpen((value) => !value)}>{chipsOpen ? 'Show fewer' : `+${rows.length - CHIP_PREVIEW} more`}</button></li>}
      </ul>
      <dl className={styles.stats}>
        <Stat label="Annual tuition" year={summary.tuitionYear} value={tuition} note={tuitionNote} />
        <Stat label="Median package" year={summary.placementYear} value={lpaRange(summary.medianMin, summary.medianMax)} note={medianNote} />
        <Stat label="Highest package" year={summary.placementYear} value={summary.highestMax == null ? 'Not provided' : single ? `₹${summary.highestMax} LPA` : `Up to ₹${summary.highestMax} LPA`} />
      </dl>
      <p className={styles.deepLinks}>
        <Link href={`${href}#courses`}><Icon name="collegesRupee" />Courses &amp; fees</Link>
        <Link href={`${href}#placements`}><Icon name="collegesBriefcase" />Placements</Link>
      </p>
    </div>
    <div className={styles.actions}>
      <Link className="button button--primary" href={href}>View college<span className="sr-only">: {group.name}</span><Icon name="arrow" /></Link>
      {single
        ? compareButton(rows[0], (pressed) => <>{pressed ? 'Added to compare' : 'Add to compare'}<span className="sr-only"> {group.shortName} {courseName(rows[0])}</span></>)
        : <button type="button" className={`button button--outline ${styles.compareButton}`} aria-expanded={pickerOpen} aria-controls={pickerId} onClick={() => setPickerOpen((value) => !value)}>
          <Icon name="compare" />{selectedRows.length ? `Comparing ${selectedRows.length}` : 'Add to compare'}<Icon name="chevron" />
        </button>}
      <Link className={`text-link ${styles.budgetLink}`} href={`/budget?course=${budgetId}`}><Icon name="wallet" />Check budget<span className="sr-only"> for {courseById.get(budgetId)?.name}</span></Link>
    </div>
    {!single && pickerOpen && <div id={pickerId} className={styles.picker}>
      <p>Pick a course to compare at {group.shortName} <small>· up to {COMPARE_MAX} colleges per course</small></p>
      <div>{rows.map((row) => <span key={row.id}>{compareButton(row, (pressed) => <>{courseName(row)}<span className="sr-only">{pressed ? ' added to compare' : ' add to compare'}</span></>)}</span>)}</div>
    </div>}
    {notice && <p className={styles.notice} data-full={notice.full || undefined}><Icon name="collegesInfo" />{notice.text}{notice.full && <> <Link href={compareHref(notice.courseId)}>Review your picks</Link></>}</p>}
  </article>;
}
