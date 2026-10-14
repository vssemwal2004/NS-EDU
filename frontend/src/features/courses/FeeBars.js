import styles from './Detail.module.css';

const pct = (value, max) => `${max ? Math.max(1.5, (value / max) * 100) : 0}%`;

// Horizontal bars, one per programme, scaled 0 → course max with a dashed median rule.
// Values are written as text beside each bar, so the SVG itself is decorative.
export default function FeeBars({ id, title, summary, rows, value, format, medianValue, medianLabel, tone = 'wine', scale }) {
  const values = rows.map(value).filter((item) => item != null);
  const max = Math.max(...values, 0);
  const ordered = rows.toSorted((a, b) => (value(b) ?? -1) - (value(a) ?? -1));
  return <figure className={styles.chart} data-tone={tone} aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
    <figcaption>
      <h3 id={`${id}-title`}>{title}</h3>
      <p id={`${id}-summary`}>{summary}</p>
    </figcaption>
    <ul className={styles.bars}>{ordered.map((row) => {
      const amount = value(row);
      return <li key={row.id}>
        <span className={styles.barLabel}>{row.shortName}</span>
        {amount == null ? <span className={styles.barEmpty}>Not reported</span> : <svg className={styles.barPlot} width="100%" height="24" aria-hidden="true" focusable="false">
          <rect className={styles.barTrack} x="0" y="5" width="100%" height="14" rx="4" />
          <rect className={styles.barFill} x="0" y="5" width={pct(amount, max)} height="14" rx="4" />
          {medianValue != null && values.length > 1 && <line className={styles.barMedian} x1={pct(medianValue, max)} x2={pct(medianValue, max)} y1="0" y2="24" />}
        </svg>}
        <span className={styles.barValue}>{amount == null ? '—' : format(amount)}</span>
      </li>;
    })}</ul>
    {values.length > 0 && <div className={styles.chartFoot} aria-hidden="true">
      <span className={styles.axis}><span>{scale(0)}</span><span>{scale(max / 2)}</span><span>{scale(max)}</span></span>
      {medianValue != null && values.length > 1 && <span className={styles.legend}><i />{medianLabel}</span>}
    </div>}
  </figure>;
}
