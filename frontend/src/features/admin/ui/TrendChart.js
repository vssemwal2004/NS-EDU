'use client';
import { useId, useRef, useState } from 'react';
import styles from './Charts.module.css';

const WIDTH = 720;
const PAD = { top: 14, right: 16, bottom: 30, left: 46 };
const MAX_COLUMNS = 45;
// Four gridline steps of 1/2/5 × 10^k (whole numbers only: these are counts).
function niceStep(max) {
  const raw = Math.max(1, max) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((step) => step >= raw && Number.isInteger(step)) ?? 10 * power;
}

/**
 * Counts over time: columns up to 45 points, a line beyond. Pointer and arrow keys move a tooltip;
 * a visually hidden table carries the same numbers for screen readers.
 * data: [{ key, value, short, long }] (short = axis label, long = tooltip/table label)
 */
export default function TrendChart({ data, title, valueLabel = 'Leads', height = 240 }) {
  const id = useId();
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const count = data.length;
  if (!count) return null;
  const step = niceStep(Math.max(...data.map((item) => item.value)));
  const top = step * 4;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;
  const columns = count <= MAX_COLUMNS;
  const slot = plotW / count;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const x = (index) => (columns ? PAD.left + slot * (index + 0.5) : PAD.left + (count > 1 ? (index / (count - 1)) * plotW : plotW / 2));
  const y = (value) => base - (value / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(count / (columns ? 8 : 6)));
  const ticks = data.map((_, index) => index).filter((index) => index % labelEvery === 0);
  const column = (index, value) => {
    const h = value ? Math.max((value / top) * plotH, 3) : 0;
    if (!h) return '';
    const left = x(index) - barW / 2;
    const r = Math.min(4, h, barW / 2);
    return `M${left} ${base}V${base - h + r}Q${left} ${base - h} ${left + r} ${base - h}H${left + barW - r}Q${left + barW} ${base - h} ${left + barW} ${base - h + r}V${base}Z`;
  };
  const line = data.map((item, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(item.value).toFixed(1)}`).join('');
  const clamp = (index) => Math.min(count - 1, Math.max(0, index));
  const onPointerMove = (event) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box?.width) return;
    const at = ((event.clientX - box.left) / box.width) * WIDTH - PAD.left;
    if (at < -slot / 2 || at > plotW + slot / 2) { setActive(null); return; }
    setActive(clamp(columns ? Math.floor(at / slot) : Math.round((at / plotW) * (count - 1))));
  };
  const onKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 };
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setActive(event.key === 'Home' ? 0 : count - 1); return; }
    if (event.key === 'Escape') { setActive(null); return; }
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive((current) => clamp((current ?? count - 1) + moves[event.key]));
  };
  const current = active === null ? null : data[active];
  const left = current ? Math.min(92, Math.max(8, (x(active) / WIDTH) * 100)) : 0;
  return <figure className={styles.chart}>
    <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} tabIndex={0}
      onPointerMove={onPointerMove} onPointerLeave={() => setActive(null)} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
      onFocus={() => setActive((value) => value ?? count - 1)}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>Use the left and right arrow keys to read each day. The same numbers are in the table that follows.</desc>
      {[1, 2, 3, 4].map((tick) => <line key={tick} className={styles.grid} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick * step)} y2={y(tick * step)} />)}
      {[0, 1, 2, 3, 4].map((tick) => <text key={tick} className={styles.axis} x={PAD.left - 8} y={y(tick * step) + 4} textAnchor="end">{(tick * step).toLocaleString('en-IN')}</text>)}
      {columns
        ? data.map((item, index) => <path key={item.key} className={styles.column} data-active={active === index} d={column(index, item.value)} />)
        : <><path className={styles.area} d={`${line}L${x(count - 1)} ${base}L${x(0)} ${base}Z`} /><path className={styles.line} d={line} /></>}
      <line className={styles.baseline} x1={PAD.left} x2={WIDTH - PAD.right} y1={base} y2={base} />
      {ticks.map((index) => <text key={data[index].key} className={styles.axis} x={x(index)} y={height - 8}
        textAnchor={!columns && index === 0 ? 'start' : !columns && index === count - 1 ? 'end' : 'middle'}>{data[index].short}</text>)}
      {current && !columns && <g aria-hidden="true">
        <line className={styles.crosshair} x1={x(active)} x2={x(active)} y1={PAD.top} y2={base} />
        <circle className={styles.dot} cx={x(active)} cy={y(current.value)} r={5} />
      </g>}
    </svg>
    {current && <div className={styles.tooltip} style={{ left: `${left}%`, top: `${(y(current.value) / height) * 100}%` }} aria-hidden="true">
      <strong>{current.value.toLocaleString('en-IN')}</strong><span>{current.long}</span>
    </div>}
    <p className="sr-only" aria-live="polite">{current ? `${current.long}: ${current.value.toLocaleString('en-IN')} ${valueLabel.toLowerCase()}` : ''}</p>
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">{valueLabel}</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.key}><th scope="row">{item.long}</th><td>{item.value.toLocaleString('en-IN')}</td></tr>)}</tbody>
    </table>
  </figure>;
}
