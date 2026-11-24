'use client';
// Dashboard building blocks shared by the console home and its Insights block: a titled card, the pipeline bar,
// the stage donut and the 7-day bars. Colours come from each stage's jewel tone (crm/meta STAGES).
import Link from 'next/link';
import { n, cx } from '../analytics/shared';
import { STAGES } from '../crm/meta';
import styles from '../Dashboard.module.css';

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
export function Card({ title, meta, action, className, children }) {
  return <section className={cx(styles.card, className)}>
    <header className={styles.cardHead}><h2>{title}</h2>{meta && <span className={styles.meta}>{meta}</span>}{action}</header>
    {children}
  </section>;
}

export function Pipeline({ stages, className = styles.w5, title = 'Pipeline' }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  return <Card title={title} meta={`${n(total)} leads`} className={className}>
    <div className={styles.stack} role="img" aria-label={stages.map((stage) => `${STAGES[stage.status]?.label}: ${stage.count}`).join(', ')}>
      {stages.map((stage) => stage.count > 0 && <i key={stage.status} className="crm-tone" data-tone={STAGES[stage.status]?.tone} style={{ flexGrow: stage.count }} />)}
    </div>
    <ul className={styles.legend}>
      {stages.map((stage) => <li key={stage.status}>
        <Link href={`/admin/leads?status=${stage.status}`} className={cx('crm-tone', styles.legendChip)} data-tone={STAGES[stage.status]?.tone}>{STAGES[stage.status]?.label}</Link>
        <strong className="crm-tabnum">{n(stage.count)}</strong>
        <small className="crm-tabnum">{total ? Math.round((stage.count / total) * 100) : 0}%</small>
      </li>)}
    </ul>
  </Card>;
}

const RING = 2 * Math.PI * 54;
export function Donut({ stages, className = styles.w3 }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  let offset = 0;
  return <Card title="By stage" meta="Share of leads" className={className}>
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 140 140" className={styles.donut} role="img" aria-label={`${n(total)} leads by stage`}>
        <circle cx="70" cy="70" r="54" className={styles.donutTrack} />
        <g transform="rotate(-90 70 70)">
          {total > 0 && stages.map((stage) => {
            const length = (stage.count / total) * RING;
            const arc = <circle key={stage.status} cx="70" cy="70" r="54" className="crm-tone" data-tone={STAGES[stage.status]?.tone}
              style={{ stroke: 'var(--tone-solid)', strokeDasharray: `${Math.max(0, length - 2)} ${RING}`, strokeDashoffset: -offset }} />;
            offset += length;
            return arc;
          })}
        </g>
        <text x="70" y="72" className={styles.donutValue}>{n(total)}</text>
        <text x="70" y="90" className={styles.donutLabel}>leads</text>
      </svg>
    </div>
  </Card>;
}

export function Week({ days }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return <Card title="New leads, last 7 days" meta={`${n(total)} in total`} className={styles.w4}>
    <div className={styles.bars} role="img" aria-label={days.map((day) => `${day.day}: ${day.count}`).join(', ')}>
      {days.map((day, index) => <div key={day.day} className={styles.bar}>
        <small className="crm-tabnum">{n(day.count)}</small>
        <span data-today={index === days.length - 1 || undefined} style={{ height: `${Math.max(4, Math.round((day.count / max) * 100))}%` }} />
        <em>{index === days.length - 1 ? 'Today' : weekday.format(new Date(`${day.day}T12:00:00Z`))}</em>
      </div>)}
    </div>
  </Card>;
}
