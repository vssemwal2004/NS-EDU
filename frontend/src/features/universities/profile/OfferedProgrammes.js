'use client';
import { useId, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Profile.module.css';

const PAGE = 24;

// Programmes the institution publishes itself. Long lists get a filter box; fees appear only where
// a figure was actually found.
export default function OfferedProgrammes({ rows, withFees }) {
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
        <span className={styles.offeredFee} data-missing={row.fee ? undefined : true}>
          {row.fee ? <>{row.fee}<small>a year</small></> : row.feeNote || 'Fee not published'}
        </span>
      </li>)}
    </ul> : <p className={styles.notice}><Icon name="uniInfo" />No programme matches “{query}”.</p>}
    {!all && !needle && matches.length > PAGE && <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => setAll(true)}>
      Show all {matches.length} programmes<Icon name="chevron" />
    </button>}
    {!withFees && rows.length > 0 && <p className={styles.footnote}>Fees for these programmes are not published on the institution’s website.</p>}
  </div>;
}
