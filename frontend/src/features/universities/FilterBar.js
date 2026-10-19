'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useDirectory } from './DirectoryState';
import { clearedFilters } from './directory-url';
import { SORT_OPTIONS, formatCount } from './labels';
import styles from './Directory.module.css';

const optionText = (option) => `${option.label}${option.count != null ? ` (${formatCount(option.count)})` : ''}`;
const focusResults = () => document.getElementById('uni-results-title')?.focus();

function Options({ group }) {
  return <>
    <option value="">{group.any || 'Any'}</option>
    {group.options.map((option) => <option key={option.value} value={option.value}>{optionText(option)}</option>)}
  </>;
}

/**
 * Desktop: one sticky segmented bar (every filter + sort). Tablet/phone: a compact sticky row that opens a
 * bottom sheet; each change applies at once, so the sheet's button can show the live result count.
 * groups: [{ key, label, any?, disabled?, options: [{ value, label, count? }] }]
 */
export default function FilterBar({ groups, total, activeCount }) {
  const { params, pending, go } = useDirectory();
  const sheet = useRef(null);
  const [open, setOpen] = useState(false);
  const sort = params.sort || 'relevance';

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [open]);

  const show = () => { sheet.current?.showModal(); setOpen(true); };
  const hide = () => sheet.current?.close();
  const sortSelect = (id, className) => <select id={id} className={className} value={sort} onChange={(event) => go({ sort: event.target.value })}>
    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;

  return <>
    <div className={styles.bar} role="group" aria-label="Filter universities">
      <div className={`lux-container lux-container--wide ${styles.barInner}`}>
        <div className={styles.segments}>
          {groups.map((group) => <label key={group.key} className={styles.segment} htmlFor={`bar-${group.key}`} data-active={params[group.key] ? true : undefined}>
            <span className={styles.segmentLabel}>{group.label}</span>
            <select id={`bar-${group.key}`} className={styles.segmentSelect} value={params[group.key] || ''} disabled={group.disabled} onChange={(event) => go({ [group.key]: event.target.value })}>
              <Options group={group} />
            </select>
          </label>)}
        </div>
        <label className={styles.sortSegment} htmlFor="uni-sort">
          <span className={styles.segmentLabel}><Icon name="uniSort" />Sort by</span>
          {sortSelect('uni-sort', styles.segmentSelect)}
        </label>
      </div>
    </div>

    <div className={styles.compactBar}>
      <div className={`lux-container ${styles.compactInner}`}>
        <button type="button" className={styles.filterButton} aria-haspopup="dialog" aria-expanded={open} onClick={show}>
          <Icon name="uniSliders" />Filters{activeCount > 0 && <span className={styles.countBadge}>{activeCount}<span className="sr-only"> applied</span></span>}
        </button>
        <label className={styles.compactSort} htmlFor="uni-sort-compact">
          <span className="sr-only">Sort by</span><Icon name="uniSort" />
          {sortSelect('uni-sort-compact', styles.compactSelect)}
        </label>
      </div>
    </div>

    <dialog ref={sheet} className={styles.sheet} aria-labelledby="filter-sheet-title" onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === sheet.current) hide(); }}>
      <div className={styles.sheetPanel}>
        <header className={styles.sheetHead}>
          <span className={styles.sheetGrip} aria-hidden="true" />
          <h2 id="filter-sheet-title">Filters{activeCount > 0 && <small><span className="sr-only">, </span>{activeCount} applied</small>}</h2>
          <button type="button" className="lux-button lux-button--ghost lux-button--icon" aria-label="Close filters" onClick={hide}><Icon name="close" /></button>
        </header>
        <div className={styles.sheetBody}>
          {groups.map((group) => <div key={group.key} className={styles.sheetField}>
            <label className="lux-label" htmlFor={`sheet-${group.key}`}>{group.label}</label>
            <select id={`sheet-${group.key}`} className="lux-field" value={params[group.key] || ''} disabled={group.disabled} onChange={(event) => go({ [group.key]: event.target.value })}>
              <Options group={group} />
            </select>
          </div>)}
          <div className={styles.sheetField}>
            <label className="lux-label" htmlFor="sheet-sort">Sort by</label>
            {sortSelect('sheet-sort', 'lux-field')}
          </div>
        </div>
        <footer className={styles.sheetFoot}>
          <button type="button" className="lux-button lux-button--ghost" disabled={!activeCount} onClick={() => go(clearedFilters())}>Clear all</button>
          <button type="button" className="lux-button lux-button--primary" onClick={() => { hide(); focusResults(); }} aria-live="polite">
            {pending ? 'Updating…' : total ? `Show ${formatCount(total)} ${total === 1 ? 'result' : 'results'}` : 'No results — adjust filters'}
          </button>
        </footer>
      </div>
    </dialog>
  </>;
}

export function ActiveFilters({ chips }) {
  const { go } = useDirectory();
  if (!chips.length) return null;
  return <div className={styles.chips}>
    <ul aria-label="Active filters">{chips.map((chip) => <li key={chip.key}>
      <button type="button" className={styles.chip} aria-label={`Remove filter: ${chip.label}`} onClick={() => go({ [chip.key]: '' })}>
        <span className={styles.chipKey}>{chip.name}</span>{chip.label}<Icon name="close" />
      </button>
    </li>)}</ul>
    <button type="button" className="lux-link" onClick={() => { go(clearedFilters()); focusResults(); }}>Clear all</button>
  </div>;
}
