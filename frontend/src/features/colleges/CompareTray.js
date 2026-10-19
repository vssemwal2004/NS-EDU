'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { COMPARE_MAX, compareHref } from './compareStore';
import styles from './Ledger.module.css';

// Per-course groups of compare picks; shared by the desktop tray and the mobile sheet.
export function CompareGroups({ compare, courseById, onRemove }) {
  return <div className={styles.trayGroups}>
    {Object.entries(compare.lists).map(([courseId, rows]) => {
      const name = courseById.get(courseId)?.name || courseId;
      return <section key={courseId} className={styles.trayGroup} aria-label={`${name} comparison`}>
        <h3>{name}<span>{rows.length}/{COMPARE_MAX}</span></h3>
        <ul>{rows.map((row) => <li key={row.id}><span>{row.shortName}</span><button type="button" aria-label={`Remove ${row.shortName} (${name}) from compare`} onClick={() => onRemove(row)}><Icon name="close" /></button></li>)}</ul>
        {rows.length < 2
          ? <small>Add one more {name} college for a side-by-side table.</small>
          : <Link className="lux-button lux-button--gold lux-button--sm lux-button--block" href={compareHref(courseId, rows.map((row) => row.id))}>Compare {rows.length}<span className="sr-only"> {name} colleges</span><Icon name="arrow" /></Link>}
      </section>;
    })}
  </div>;
}

export default function CompareTray({ compare, courseById, onRemove, open, onToggle }) {
  if (!compare.total) return null;
  return <aside className={`lux-surface-dark ${styles.tray}`} aria-label="Compare tray" data-open={open || undefined}>
    <div className={styles.trayHead}>
      <p><Icon name="compare" /><strong>Compare shortlist</strong><span>{compare.total} {compare.total === 1 ? 'college' : 'colleges'} · saved in this browser</span></p>
      <button type="button" className={styles.trayToggle} aria-expanded={open} aria-controls="compare-tray-body" onClick={onToggle}>{open ? 'Hide' : 'Show'}<Icon name="chevron" /></button>
    </div>
    <div id="compare-tray-body" hidden={!open}><CompareGroups compare={compare} courseById={courseById} onRemove={onRemove} /></div>
  </aside>;
}
