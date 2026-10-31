'use client';
import { useId, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { estimateRange } from './profile-data';
import styles from './Profile.module.css';

const PAGE = 24;

// Programmes the institution publishes itself. Long lists get a filter box; a fee appears where one
// was published, and otherwise a clearly labelled estimate where comparable institutions give one.
export default function OfferedProgrammes({ rows, withFees, withEstimates }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const id = useId();
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => (needle ? rows.filter((row) => `${row.name} ${row.level}`.toLowerCase().includes(needle)) : rows), [rows, needle]);
  const shown = all || needle ? matches : matches.slice(0, PAGE);

  return <div className={styles.offered}>
    {rows.length > 8 && <div className={styles.offeredSearch}>
      <label className="sr-only" htmlFor={id}>Filter programmes</label>
      <Icon name="search" />
      <input id={id} className="lux-field" type="search" value={query} placeholder="Filter programmes, e.g. B.Tech"
        onChange={(event) => setQuery(event.target.value)} />
    </div>}
    <p className={styles.offeredCount} aria-live="polite">
      {matches.length === rows.length ? `${rows.length} programmes listed` : `${matches.length} of ${rows.length} programmes match`}
    </p>
    {shown.length > 0 ? <ul className={styles.offeredList}>
      {shown.map((row) => <li key={row.id}>
        <div>
          <strong>{row.name}</strong>
          {row.meta && <small>{row.meta}</small>}
        </div>
        <span className={styles.offeredFee} data-missing={row.fees.length || row.estimate ? undefined : true}>
          {row.fees.length ? row.fees.map((fee) => <span key={fee.label}>{fee.value}<small>{fee.label}</small></span>)
            : row.estimate ? <EstimatedFee estimate={row.estimate} />
              : row.feeNote || 'Fee not published'}
        </span>
      </li>)}
    </ul> : <p className={styles.notice}><Icon name="uniInfo" />No programme matches “{query}”.</p>}
    {!all && !needle && matches.length > PAGE && <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => setAll(true)}>
      Show all {matches.length} programmes<Icon name="chevron" />
    </button>}
    {rows.length > 0 && <p className={styles.footnote}>{withFees
      ? 'Each fee is shown for the period the institution prints it for — a year, a semester or the whole programme — and is never converted. Hostel and other charges are not included.'
      : 'A fee appears only when the source states what period it is for; other figures keep the source wording.'}</p>}
    {withEstimates && <p className={styles.footnote}>
      <strong>Estimated</strong> ranges are not published by this institution. They are the middle half of the fees that similar institutions publish for the same course, in the same period, so treat them as a guide and confirm the real fee with the institution before you apply.
    </p>}
  </div>;
}

// "≈ ₹74,000 – ₹1.35 L a semester · Estimated", with the basis one tap away for screen readers and hover.
function EstimatedFee({ estimate }) {
  const basis = `Estimated from the published fees of ${estimate.sample} ${estimate.ownership ? `${estimate.ownership} ` : ''}institutions offering this course in ${estimate.scope}. This institution has not published its fee.`;
  return <span className={styles.estimate} title={basis}>
    <span>≈ {estimateRange(estimate)}<small>{estimate.period}</small></span>
    <em className={styles.estimateTag}>Estimated</em>
    <span className="sr-only">{basis}</span>
  </span>;
}
