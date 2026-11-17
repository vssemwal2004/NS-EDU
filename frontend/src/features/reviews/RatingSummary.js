'use client';
import Link from 'next/link';
import { Stars } from './Stars';
import styles from './Reviews.module.css';

const n = (value) => new Intl.NumberFormat('en-IN').format(value ?? 0);

/**
 * Average, stars, count and the 5→1 distribution. With `filterHref` each bar links to that star
 * filter (the /reviews page); `active` marks the current one.
 */
export default function RatingSummary({ summary, filterHref, active = null, tone = 'light' }) {
  const count = summary?.count ?? 0;
  const max = Math.max(1, ...(summary?.distribution ?? []).map((row) => row.count));
  return <div className={styles.summary} data-tone={tone}>
    <div className={styles.summaryScore}>
      <p className={styles.average}>{count ? summary.average.toFixed(1) : '—'}<span>/5</span></p>
      <Stars value={summary?.average ?? 0} size="lg" label={count ? `Average rating ${summary.average} out of 5` : 'No ratings yet'} />
      <p className={styles.count}>{count ? `${n(count)} verified review${count === 1 ? '' : 's'}` : 'No reviews yet'}</p>
    </div>
    <ul className={styles.bars} aria-label="Ratings by number of stars">
      {(summary?.distribution ?? [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 }))).map((row) => {
        const share = count ? Math.round((row.count / count) * 100) : 0;
        const body = <>
          <span className={styles.barLabel}>{row.stars}★</span>
          <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${(row.count / max) * 100}%` }} /></span>
          <span className={styles.barCount}>{n(row.count)}</span>
          <span className="sr-only">{`${row.stars} stars: ${n(row.count)} reviews (${share}%)`}</span>
        </>;
        return <li key={row.stars} data-active={active === row.stars || undefined}>
          {filterHref && row.count ? <Link href={filterHref(active === row.stars ? null : row.stars)} scroll={false} aria-current={active === row.stars ? 'true' : undefined}>{body}</Link> : <div>{body}</div>}
        </li>;
      })}
    </ul>
  </div>;
}
