import Link from 'next/link';
import styles from './Charts.module.css';

export const formatShare = (part, total) => {
  if (!total) return '';
  const share = (part / total) * 100;
  if (share > 0 && share < 0.1) return '<0.1%';
  return `${share.toFixed(share < 10 && share > 0 ? 1 : 0)}%`;
};

/**
 * Horizontal bars as a list (ranked or in a fixed order such as a funnel). Bars scale to the largest row
 * (or `max`); with `total`, each row also shows its share. Rows with an `href` are links (the whole row is the target).
 * One accent colour; a row may carry a status `tone` (good | warn | bad | info | neutral) only when the colour means a state.
 * rows: [{ key, label, hint?, value, href?, tone?, share?, title? }]   (`share` overrides the computed share text;
 * `title` is a hover tooltip, for detail that should not take a second line)
 */
export default function BarList({ rows, total = 0, max: maxValue, unit = 'leads', label, emptyText = 'Nothing to show for this range' }) {
  if (!rows.length) return <p className={styles.empty}>{emptyText}</p>;
  const max = Math.max(1, maxValue ?? 0, ...rows.map((row) => row.value));
  const shares = rows.map((row) => row.share ?? formatShare(row.value, total));
  // Every row keeps the share column when any row has one, so counts line up in one right-aligned column.
  const shareColumn = shares.some(Boolean);
  return <ol className={styles.bars} aria-label={label}>
    {rows.map((row, index) => {
      const share = shares[index];
      const body = <>
        <span className={styles.barText}><span className={styles.barLabel}>{row.label}</span>{row.hint && <small>{row.hint}</small>}</span>
        <span className={styles.barValue} data-noshare={shareColumn ? undefined : ''}>
          <span>{row.value.toLocaleString('en-IN')}</span>
          {shareColumn && <small aria-hidden="true">{share}</small>}
          <span className="sr-only"> {unit}{share && `, ${share}${row.share ? '' : ' of the total'}`}</span>
        </span>
        <span className={styles.barTrack} aria-hidden="true">
          <span className={row.tone ? `crm-tone ${styles.barFill}` : styles.barFill} data-tone={row.tone} data-zero={row.value === 0} style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }} />
        </span>
      </>;
      const title = row.title ?? (row.hint ? `${row.label} · ${row.hint}` : row.label);
      return <li key={row.key}>{row.href ? <Link className={styles.barRow} href={row.href} title={title}>{body}</Link> : <div className={styles.barRow} title={row.title}>{body}</div>}</li>;
    })}
  </ol>;
}
