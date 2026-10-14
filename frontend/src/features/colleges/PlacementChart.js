import { formatSalary } from '@/lib/college-catalog';
import styles from './Profile.module.css';

const TICKS = 4;
const pct = (value, max) => `${((value / max) * 100).toFixed(2)}%`;

// Paired horizontal bars (median over highest) on one shared LPA scale. Geometry is SVG
// (stretched to the row width); value labels stay HTML so they never scale or blur.
export default function PlacementChart({ rows, courseNames, benchmarks }) {
  const highest = Math.max(1, ...rows.map((row) => row.highestSalaryLpa ?? row.medianSalaryLpa ?? 0));
  const step = Math.max(1, Math.ceil(highest / TICKS));
  const max = step * TICKS;
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => index * step);
  const reported = rows.filter((row) => row.medianSalaryLpa != null);
  const summary = reported.length
    ? reported.map((row) => `${courseNames[row.courseId]?.name || row.courseId}: median ${row.medianSalaryLpa} LPA, highest ${row.highestSalaryLpa ?? 'not provided'}`).join('; ')
    : 'No programme reports placement data';
  const grid = <g className={styles.chartGrid}>{ticks.map((tick) => <line key={tick} x1={(tick / max) * 100} x2={(tick / max) * 100} y1="0" y2="40" vectorEffect="non-scaling-stroke" />)}</g>;

  return <div className={styles.chart} role="img" aria-label={`Placement packages, ${rows[0]?.placementYear || ''}. ${summary}.`}>
    <div className={styles.chartAxis} aria-hidden="true"><span />
      <div>{ticks.map((tick) => <span key={tick} style={{ left: pct(tick, max) }}>₹{tick}{tick === max ? ' LPA' : ''}</span>)}</div>
    </div>
    {rows.map((row) => {
      const name = courseNames[row.courseId]?.name || row.courseId;
      const bench = benchmarks[row.courseId];
      const missing = row.medianSalaryLpa == null;
      return <div key={row.id} className={styles.chartRow} data-missing={missing || undefined}>
        <p className={styles.chartLabel}><strong>{name}</strong>{bench && !missing && <small>Course median across {bench.count} listed colleges: ₹{bench.value} LPA</small>}</p>
        <div className={styles.chartPlot}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {grid}
            {missing ? <rect className={styles.chartEmpty} x="0" y="8" width="100" height="24" vectorEffect="non-scaling-stroke" /> : <>
              <rect className={styles.barMedian} x="0" y="4" width={(row.medianSalaryLpa / max) * 100} height="14"><title>{`${name} median ${formatSalary(row.medianSalaryLpa)}`}</title></rect>
              {row.highestSalaryLpa != null && <rect className={styles.barHighest} x="0" y="22" width={(row.highestSalaryLpa / max) * 100} height="14"><title>{`${name} highest ${formatSalary(row.highestSalaryLpa)}`}</title></rect>}
              {bench && <line className={styles.chartMarker} x1={(bench.value / max) * 100} x2={(bench.value / max) * 100} y1="0" y2="20" vectorEffect="non-scaling-stroke" />}
            </>}
          </svg>
          {missing ? <span className={styles.chartMissing}>Not provided</span> : <>
            <span className={styles.valueMedian} style={{ left: pct(Math.max(row.medianSalaryLpa, bench?.value ?? 0), max) }}>₹{row.medianSalaryLpa} LPA</span>
            <span className={styles.valueHighest} style={{ left: pct(row.highestSalaryLpa ?? row.medianSalaryLpa, max) }}>{row.highestSalaryLpa == null ? 'Highest not provided' : `₹${row.highestSalaryLpa} LPA`}</span>
          </>}
        </div>
      </div>;
    })}
  </div>;
}
