'use client';
import Icon from '@/components/ui/Icon';
import { LuxLink } from './GuidePage';
import { useTicks } from './ticks';
import styles from './AdmissionChecklist.module.css';

// Client pieces of the admission checklist board. All share one saved list ('nsedu:guide-checklist:admission-checklist').
const GUIDE = 'admission-checklist';
const RING = 2 * Math.PI * 52;

export function BoardSummary({ groups, allIds }) {
  const { done, clear, count, total } = useTicks(GUIDE, allIds);
  const percent = total ? Math.round((count / total) * 100) : 0;
  return <div className={styles.summary}>
    <div className={styles.ring}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r="52" className={styles.ringTrack} />
        <circle cx="60" cy="60" r="52" className={styles.ringFill} style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - percent / 100) }} />
      </svg>
      <p role="status" aria-live="polite"><strong>{percent}%</strong><span>{count} of {total} ticked</span></p>
    </div>
    <ul className={styles.summaryGroups}>{groups.map((group) => {
      const ticked = group.items.filter((item) => done.has(item.id)).length;
      return <li key={group.id} data-complete={ticked === group.items.length || undefined}>
        <a href={`#${group.id}`}><span>{group.title}</span><small>{ticked}/{group.items.length}</small></a>
        <span className={styles.miniTrack} aria-hidden="true"><span style={{ transform: `scaleX(${group.items.length ? ticked / group.items.length : 0})` }} /></span>
      </li>;
    })}</ul>
    <div className={styles.summaryActions}>
      <button type="button" className="lux-button lux-button--primary" onClick={() => window.print()}><Icon name="guidePrint" />Print checklist</button>
      <button type="button" className="lux-button lux-button--ghost" onClick={() => { clear(); document.querySelector(`[id="${groups[0]?.id}"] input`)?.focus(); }} disabled={count === 0}><Icon name="guideReset" />Clear ticks</button>
    </div>
  </div>;
}

export function TickGroup({ group, number, allIds }) {
  const { done, toggle } = useTicks(GUIDE, allIds);
  const ticked = group.items.filter((item) => done.has(item.id)).length;
  const complete = ticked === group.items.length && ticked > 0;
  return <section id={group.id} className={`${styles.group} ${group.documents ? styles.groupDocs : ''}`} data-complete={complete || undefined} aria-labelledby={`${group.id}-title`}>
    <header className={styles.groupHead}>
      <span className={styles.groupBadge} aria-hidden="true">{complete ? <Icon name="check" /> : group.documents ? <Icon name="guideFiles" /> : number}</span>
      <div>
        {group.kicker && <p className={styles.groupKicker}>{group.kicker}</p>}
        <h2 id={`${group.id}-title`} className={styles.groupTitle}>{group.title}</h2>
      </div>
      <span className={styles.groupCount}><span aria-hidden="true">{ticked}/{group.items.length}</span><span className="sr-only">{ticked} of {group.items.length} ticked</span></span>
    </header>
    {group.text && <p className={styles.groupText}>{group.text}</p>}
    <ul className={styles.ticks}>{group.items.map((item) => <li key={item.id}>
      <label data-checked={done.has(item.id) || undefined}>
        <input type="checkbox" checked={done.has(item.id)} onChange={() => toggle(item.id)} />
        <span className={styles.box} aria-hidden="true"><Icon name="check" /></span>
        <span className={styles.tickText}><span>{item.label}</span>{item.hint && <small>{item.hint}</small>}</span>
      </label>
    </li>)}</ul>
    {(group.links?.length > 0 || group.note) && <footer className={styles.groupFoot}>
      {group.links?.map((link) => <LuxLink key={link.href} {...link} />)}
      {group.note && <p>{group.note}</p>}
    </footer>}
  </section>;
}

// Phone-only action bar: progress at a glance while ticking, plus print.
export function BoardBar({ allIds }) {
  const { count, total } = useTicks(GUIDE, allIds);
  return <div className={`lux-bottom-bar ${styles.bar}`}>
    <a href="#board-summary" className={styles.barCount}><strong>{count}/{total}</strong><span>ticked</span></a>
    <span className={styles.barTrack} aria-hidden="true"><span style={{ transform: `scaleX(${total ? count / total : 0})` }} /></span>
    <button type="button" className="lux-button lux-button--outline lux-button--sm" onClick={() => window.print()}><Icon name="guidePrint" />Print</button>
  </div>;
}
