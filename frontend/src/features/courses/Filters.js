'use client';
import Icon from '@/components/ui/Icon';
import { LEVEL_LABEL } from './data';
import styles from './Listing.module.css';

export function syncUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); });
  window.history.replaceState(window.history.state, '', url);
}

export function SearchBox({ label, value, placeholder, onChange }) {
  return <label className={styles.search}>
    <Icon name="search" /><span className="sr-only">{label}</span>
    <input type="search" value={value} placeholder={placeholder} maxLength={80} onChange={(event) => onChange(event.target.value)} />
    {value && <button type="button" className={styles.searchClear} onClick={() => onChange('')} aria-label="Clear search"><Icon name="close" /></button>}
  </label>;
}

// Single-row chip strip (scrolls sideways on small screens). Empty options stay visible but inert.
export function FieldChips({ label, value, total, items, onChange }) {
  return <div className={styles.chipStrip} role="group" aria-label={label}>
    {[{ value: '', label: 'All', count: total }, ...items].map((item) => {
      const inert = item.count === 0 && value !== item.value;
      return <button key={item.value || 'all'} type="button" className={styles.chip} aria-pressed={value === item.value} aria-disabled={inert || undefined}
        onClick={() => { if (!inert) onChange(item.value); }}>
        {item.label}<span className={styles.count}>{item.count}</span>
      </button>;
    })}
  </div>;
}

export function LevelBadge({ level, long = false }) {
  if (long) return <span className={styles.levelBadge} data-level={level}>{LEVEL_LABEL[level]}</span>;
  return <span className={styles.levelBadge} data-level={level}><span aria-hidden="true">{level}</span><span className="sr-only">{LEVEL_LABEL[level]}</span></span>;
}
