'use client';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './Charts.module.css';

const PAD = { top: 18, right: 8, bottom: 24, left: 40 };
const MAX_COLUMNS = 45;
const fmt = (value) => value.toLocaleString('en-IN');

/** Observed pixel width of an element; charts draw in real pixels so text keeps its size on phones. */
export function useWidth(initial = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => { const next = Math.round(node.getBoundingClientRect().width); if (next > 0) setWidth(next); };
    update();
    if (typeof window.ResizeObserver === 'undefined') return undefined;
    const observer = new window.ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Round gridline step (1/2/2.5/5 × 10^k, whole numbers: these are counts) for `steps` gridlines. */
export function niceStep(max, steps = 4) {
  const raw = Math.max(1, max) / steps;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((step) => step >= raw && Number.isInteger(step)) ?? 10 * power;
}

/** The same rows as a plain table (the chart's table view). */
export function TrendTable({ data, title, valueLabel = 'Leads' }) {
  return <div className={styles.tableWrap} role="region" aria-label={`${title}, table`} tabIndex={0}>
    <table className={styles.table}>
      <caption className="sr-only">{title}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col" data-num="">{valueLabel}</th></tr></thead>
      <tbody>{[...data].reverse().map((item) => <tr key={item.key}><th scope="row">{item.long}</th><td>{fmt(item.value)}</td></tr>)}</tbody>
    </table>
  </div>;
}

/**
 * Counts over time, one accent series: columns up to 45 points, a line beyond. The highest point is labelled;
 * pointer and arrow keys move a tooltip; a visually hidden table carries the numbers for screen readers.
 * data: [{ key, value, short, long }] (short = axis label, long = tooltip/table label).
 * `table` shows the visible table view instead of the chart.
 */
export default function TrendChart({ data, title, valueLabel = 'Leads', height = 200, table = false }) {
  const id = useId();
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const count = data.length;
  if (!count) return null;
  if (table) return <TrendTable data={data} title={title} valueLabel={valueLabel} />;

  const narrow = width < 480;
  const steps = narrow ? 3 : 4;
  const max = Math.max(...data.map((item) => item.value));
  const step = niceStep(max, steps);
  const top = step * steps;
  const plotW = Math.max(width - PAD.left - PAD.right, 40);
  const plotH = height - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;
  const columns = count <= MAX_COLUMNS;
  const slot = plotW / count;
  const barW = Math.max(2, Math.min(24, slot - 2, slot * 0.72));
  const x = (index) => (columns ? PAD.left + slot * (index + 0.5) : PAD.left + (count > 1 ? (index / (count - 1)) * plotW : plotW / 2));
  const y = (value) => base - (value / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 64))));
  const ticks = data.map((_, index) => index).filter((index) => (count - 1 - index) % labelEvery === 0);
  const column = (index, value) => {
    const h = value ? Math.max((value / top) * plotH, 2) : 0;
    if (!h) return '';
    const left = x(index) - barW / 2;
    const r = Math.min(4, h, barW / 2);
    return `M${left} ${base}V${base - h + r}Q${left} ${base - h} ${left + r} ${base - h}H${left + barW - r}Q${left + barW} ${base - h} ${left + barW} ${base - h + r}V${base}Z`;
  };
  const line = data.map((item, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(item.value).toFixed(1)}`).join('');
  const peakIndex = data.reduce((best, item, index) => (item.value > data[best].value ? index : best), 0);
  const clamp = (index) => Math.min(count - 1, Math.max(0, index));
  const onPointerMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = event.clientX - box.left - PAD.left;
    if (at < -slot / 2 || at > plotW + slot / 2) { setActive(null); return; }
    setActive(clamp(columns ? Math.floor(at / slot) : Math.round((at / plotW) * (count - 1))));
  };
  const onKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageUp: 7, PageDown: -7 };
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setActive(event.key === 'Home' ? 0 : count - 1); return; }
    if (event.key === 'Escape') { setActive(null); return; }
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive((current) => clamp((current ?? count - 1) + moves[event.key]));
  };
  const current = active === null ? null : data[active];
  const tipLeft = current ? Math.min(width - 70, Math.max(70, x(active))) : 0;
  const peakX = x(peakIndex);
  return <figure className={styles.chart}>
    <div ref={ref} className={styles.plot} data-active={active !== null || undefined}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} tabIndex={0}
        onPointerMove={onPointerMove} onPointerLeave={() => setActive(null)} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
        onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setActive((value) => value ?? count - 1); }}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>Use the left and right arrow keys to read each day. The same numbers are in the table view.</desc>
        {Array.from({ length: steps }, (_, i) => i + 1).map((tick) => <line key={tick} className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick * step)} y2={y(tick * step)} />)}
        {Array.from({ length: steps + 1 }, (_, i) => i).map((tick) => <text key={tick} className={styles.axis} x={PAD.left - 8} y={y(tick * step) + 4} textAnchor="end">{fmt(tick * step)}</text>)}
        {columns
          ? data.map((item, index) => <path key={item.key} className={styles.column} data-active={active === index} d={column(index, item.value)} />)
          : <><path className={styles.area} d={`${line}L${x(count - 1)} ${base}L${x(0)} ${base}Z`} /><path className={styles.line} d={line} /></>}
        <line className={styles.baseline} x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} />
        {ticks.map((index) => <text key={data[index].key} className={styles.axis} x={x(index)} y={height - 8}
          textAnchor={!columns && index === 0 ? 'start' : !columns && index === count - 1 ? 'end' : 'middle'}>{data[index].short}</text>)}
        {max > 0 && active === null && <text className={styles.peak} x={peakX} y={y(max) - 7} textAnchor={peakX > width - 50 ? 'end' : peakX < PAD.left + 30 ? 'start' : 'middle'}>{fmt(max)}</text>}
        {current && !columns && <g aria-hidden="true">
          <line className={styles.crosshair} x1={x(active)} x2={x(active)} y1={PAD.top} y2={base} />
          <circle className={styles.dot} cx={x(active)} cy={y(current.value)} r={5} />
        </g>}
      </svg>
      {current && <div className={styles.tooltip} style={{ left: tipLeft, top: y(current.value) }} aria-hidden="true">
        <strong>{fmt(current.value)}</strong><span>{current.long}</span>
      </div>}
    </div>
    <p className="sr-only" aria-live="polite">{current ? `${current.long}: ${fmt(current.value)} ${valueLabel.toLowerCase()}` : ''}</p>
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">{valueLabel}</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.key}><th scope="row">{item.long}</th><td>{fmt(item.value)}</td></tr>)}</tbody>
    </table>
  </figure>;
}
