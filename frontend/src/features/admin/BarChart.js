'use client';
import { useId, useState } from 'react';
import styles from './Dashboard.module.css';

// Single-series vertical bars: one brand hue, 4px rounded tops anchored to the baseline,
// recessive gridlines, per-bar hover/focus tooltip with a hit target wider than the mark.
export function ColumnChart({ data, label, formatLabel = (item) => item.label, height = 200 }) {
  const id = useId();
  const [active, setActive] = useState(null);
  const width = 640;
  const pad = { top: 16, right: 8, bottom: 28, left: 32 };
  const max = Math.max(4, ...data.map((item) => item.value));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(28, slot - 6);
  const y = (value) => pad.top + plotH - (value / top) * plotH;
  const bar = (x, value) => {
    const h = Math.max((value / top) * plotH, value ? 3 : 0);
    if (!h) return '';
    const r = Math.min(4, h, barW / 2), y0 = pad.top + plotH;
    return `M${x} ${y0}V${y0 - h + r}Q${x} ${y0 - h} ${x + r} ${y0 - h}H${x + barW - r}Q${x + barW} ${y0 - h} ${x + barW} ${y0 - h + r}V${y0}Z`;
  };
  const current = active === null ? null : data[active];
  return <figure className={styles.chart}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{label}</title>
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line className={styles.grid} x1={pad.left} x2={width - pad.right} y1={y(tick * step)} y2={y(tick * step)} /><text className={styles.axis} x={pad.left - 8} y={y(tick * step) + 4} textAnchor="end">{tick * step}</text></g>)}
      {data.map((item, index) => {
        const x = pad.left + index * slot + (slot - barW) / 2;
        return <g key={item.label}>
          <path className={styles.bar} data-active={active === index} d={bar(x, item.value)} />
          {(index % 2 === 0 || data.length <= 8) && <text className={styles.axis} x={x + barW / 2} y={height - 8} textAnchor="middle">{formatLabel(item, 'short')}</text>}
          <rect className={styles.hit} x={pad.left + index * slot} y={pad.top} width={slot} height={plotH} tabIndex={0} aria-label={`${formatLabel(item, 'long')}: ${item.value}`}
            onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} />
        </g>;
      })}
    </svg>
    {current && <div className={styles.tooltip} style={{ left: `${((pad.left + active * slot + slot / 2) / width) * 100}%`, top: `${(y(current.value) / height) * 100}%` }} role="status">
      <strong>{current.value}</strong><span>{formatLabel(current, 'long')}</span>
    </div>}
  </figure>;
}

// Horizontal ranked bars with values as text (text ink, not the series colour).
export function RankedBars({ data, total }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <ul className={styles.ranked}>
    {data.map((item) => <li key={item.label} title={`${item.label}: ${item.value}${total ? ` of ${total}` : ''}`}>
      <span className={styles.rankedLabel}>{item.label}</span>
      <span className={styles.rankedTrack}><span className={styles.rankedBar} style={{ width: `${(item.value / max) * 100}%` }} /></span>
      <span className={styles.rankedValue}>{item.value}</span>
    </li>)}
  </ul>;
}
