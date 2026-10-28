import Link from 'next/link';
import styles from './Charts.module.css';

export const formatShare = (part, total) => {
  if (!total) return '';
  const share = (part / total) * 100;
  if (share > 0 && share < 0.1) return '<0.1%';
  return `${share.toFixed(share < 10 && share > 0 ? 1 : 0)}%`;
};

/**
 * Horizontal bars as a list (ranked or in a fixed order such as a funnel). Bars scale to the largest row;
 * with `total`, each row also shows its share. Rows with an `href` are links (the whole row is the target).
 * rows: [{ key, label, hint?, value, href? }]
 */
export default function BarList({ rows, total = 0, unit = 'leads', label, emptyText = 'Nothing to show for this range.' }) {
  if (!rows.length) return <p className={styles.empty}>{emptyText}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <ol className={styles.bars} aria-label={label}>
    {rows.map((row) => {
      const share = formatShare(row.value, total);
      const body = <>
        <span className={styles.barText}><span className={styles.barLabel}>{row.label}</span>{row.hint && <small>{row.hint}</small>}</span>
        <span className={styles.barValue}>
          {row.value.toLocaleString('en-IN')}
          {share && <small aria-hidden="true">{share}</small>}
          <span className="sr-only"> {unit}{share && `, ${share} of the total`}</span>
        </span>
        <span className={styles.barTrack} aria-hidden="true"><span className={styles.barFill} data-zero={row.value === 0} style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }} /></span>
      </>;
      return <li key={row.key}>{row.href ? <Link className={styles.barRow} href={row.href} title={row.hint ? `${row.label} · ${row.hint}` : row.label}>{body}</Link> : <div className={styles.barRow}>{body}</div>}</li>;
    })}
  </ol>;
}
