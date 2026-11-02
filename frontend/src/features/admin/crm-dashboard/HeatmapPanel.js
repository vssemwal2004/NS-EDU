'use client';
import { useMemo, useRef, useState } from 'react';
import { Empty, InfoHint, n, TableToggle } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { Panel } from '@/features/admin/ui/Page';

const NONE = [];
const LEVELS = 5;
const hourText = (hour) => `${String(hour).padStart(2, '0')}:00`;
const FULL_DAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** Calls, messages and notes logged by weekday × hour (last 30 days, India time). One sequential accent ramp. */
export default function HeatmapPanel({ heatmap }) {
  const days = heatmap?.days ?? NONE;
  const grid = heatmap?.grid ?? NONE;
  const hours = heatmap?.hours ?? 24;
  const wrap = useRef(null);
  const [active, setActive] = useState(null);
  const [table, setTable] = useState(false);
  const stats = useMemo(() => {
    let max = 0; let busiest = null; let total = 0;
    const byHour = Array(hours).fill(0); const byDay = days.map(() => 0);
    grid.forEach((row, r) => row.forEach((value, c) => {
      total += value; byHour[c] += value; byDay[r] += value;
      if (value > max) { max = value; busiest = { r, c }; }
    }));
    const bestHour = byHour.reduce((best, value, index) => (value > byHour[best] ? index : best), 0);
    const bestDay = byDay.reduce((best, value, index) => (value > byDay[best] ? index : best), 0);
    return { max, busiest, total, bestHour, bestDay };
  }, [grid, days, hours]);
  const level = (value) => (value <= 0 ? 0 : Math.max(1, Math.ceil((value / stats.max) * LEVELS)));
  const show = (r, c, element) => {
    const box = wrap.current?.getBoundingClientRect(); const cell = element?.getBoundingClientRect();
    setActive({ r, c, left: box && cell ? cell.left - box.left + cell.width / 2 : 0, top: box && cell ? cell.top - box.top : 0 });
  };
  const onKey = (event) => {
    const step = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[event.key];
    if (!step) { if (event.key === 'Escape') setActive(null); return; }
    event.preventDefault();
    const from = active ?? stats.busiest ?? { r: 0, c: 0 };
    const r = Math.min(days.length - 1, Math.max(0, from.r + step[0])); const c = Math.min(hours - 1, Math.max(0, from.c + step[1]));
    show(r, c, wrap.current?.querySelector(`[data-cell="${r}-${c}"]`));
  };

  const title = 'Activity heatmap';
  const hint = 'Calls, messages and notes staff logged in the last 30 days, by weekday and hour (India time). Shows when staff log work, not when leads pick up.';
  if (!days.length || !stats.total) {
    return <Panel className={styles.wide} title={title} meta={<><InfoHint text={hint} />Last 30 days</>}>
      <Empty title="No activity logged in the last 30 days" />
    </Panel>;
  }
  const busiest = stats.busiest;
  const bestDay = FULL_DAYS[days[stats.bestDay]] ?? days[stats.bestDay];
  const summary = `Busiest slot ${days[busiest.r]} ${hourText(busiest.c)} (${n(stats.max)}). Busiest day ${bestDay}, busiest hour ${hourText(stats.bestHour)}.`;
  return <Panel className={styles.wide} title={title} meta={<><InfoHint text={hint} />{n(stats.total)} activities · last 30 days</>} actions={<TableToggle table={table} onChange={setTable} />}>
    {table ? <div className={styles.tableWrap} data-limit="" role="region" aria-label="Activity by weekday and hour, table" tabIndex={0}>
      <table className={styles.table}>
        <thead><tr><th scope="col">Day</th>{Array.from({ length: hours }, (_, c) => <th key={c} scope="col" data-num="">{String(c).padStart(2, '0')}</th>)}<th scope="col" data-num="">Total</th></tr></thead>
        <tbody>{days.map((day, r) => <tr key={day}><th scope="row">{day}</th>{grid[r].map((value, c) => <td key={c} data-num="">{value || ''}</td>)}<td data-num=""><strong>{n(grid[r].reduce((sum, value) => sum + value, 0))}</strong></td></tr>)}</tbody>
      </table>
    </div> : <div className={styles.heatWrap} ref={wrap} onPointerLeave={() => setActive(null)}>
      <div className={styles.heatScroll} tabIndex={0} role="group" aria-label={`${title}. Use the arrow keys to move between slots. ${summary}`} onKeyDown={onKey} onBlur={() => setActive(null)}>
        <div className={styles.heatmap} aria-hidden="true">
          <span />
          {Array.from({ length: hours }, (_, c) => <span key={c}>{c % 3 === 0 ? String(c).padStart(2, '0') : ''}</span>)}
          {days.map((day, r) => [
            <span key={`${day}-label`} className={styles.dayLabel}>{day}</span>,
            ...grid[r].map((value, c) => <span key={`${day}-${c}`} data-cell={`${r}-${c}`} className={styles.cell} data-level={level(value)}
              data-active={(active?.r === r && active?.c === c) || undefined} onPointerEnter={(event) => show(r, c, event.currentTarget)} />),
          ])}
        </div>
      </div>
      {active && <div className={styles.cellTip} style={{ left: active.left, top: active.top }} role="status">
        <strong>{n(grid[active.r][active.c])}</strong> {grid[active.r][active.c] === 1 ? 'activity' : 'activities'} · {FULL_DAYS[days[active.r]] ?? days[active.r]} {hourText(active.c)}
      </div>}
    </div>}
    <div className={styles.heatFoot}>
      <dl className={styles.figures}>
        <div><dt>Busiest slot</dt><dd>{days[busiest.r]} {hourText(busiest.c)} · {n(stats.max)}</dd></div>
        <div><dt>Busiest day</dt><dd>{bestDay}</dd></div>
        <div><dt>Busiest hour</dt><dd>{hourText(stats.bestHour)}</dd></div>
      </dl>
      {!table && <div className={styles.scale} aria-hidden="true"><span>Fewer</span>{Array.from({ length: LEVELS + 1 }, (_, i) => <i key={i} className={styles.cell} data-level={i} />)}<span>More</span></div>}
    </div>
  </Panel>;
}
