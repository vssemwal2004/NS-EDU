'use client';
import Icon from '@/components/ui/Icon';
import { GROUPS, SortGroup } from './FilterGroups';
import styles from './Listing.module.css';

const TABS = [...GROUPS, { id: 'sort', label: 'Sort', Component: SortGroup, active: (value) => (value.sort && value.sort !== 'default' ? 1 : 0) }];

// Mobile filter sheet (native <dialog>): category rail + options, editing a draft.
// Escape, the close button or the backdrop discard the draft; focus returns to the trigger natively.
export default function FilterDrawer({ dialogRef, draft, tab, onTab, onChange, onClear, onApply, counts, options, total, unknown }) {
  const current = TABS.find((item) => item.id === tab) || TABS[0];
  const Pane = current.Component;
  const close = () => dialogRef.current?.close();
  function keyboard(event, index) {
    const delta = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    onTab(next.id);
    event.currentTarget.parentElement.querySelector(`#drawer-tab-${next.id}`)?.focus();
  }
  return <dialog ref={dialogRef} className={styles.drawer} aria-labelledby="filter-drawer-title"
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    {draft && <div className={styles.drawerInner}>
      <div className={styles.drawerHead}>
        <div><h2 id="filter-drawer-title">Filters</h2><p aria-live="polite">{total} {total === 1 ? 'college matches' : 'colleges match'}</p></div>
        <button type="button" className="icon-button" aria-label="Close filters without applying" onClick={close}><Icon name="close" /></button>
      </div>
      <div className={styles.drawerBody}>
        <div className={styles.rail} role="tablist" aria-orientation="vertical" aria-label="Filter categories">
          {TABS.map((item, index) => {
            const count = item.active(draft);
            return <button key={item.id} type="button" role="tab" id={`drawer-tab-${item.id}`} aria-selected={item.id === current.id} aria-controls="filter-drawer-panel" tabIndex={item.id === current.id ? 0 : -1} onClick={() => onTab(item.id)} onKeyDown={(event) => keyboard(event, index)}>
              {item.label}{count > 0 && <span aria-label="1 selected">{count}</span>}
            </button>;
          })}
        </div>
        <div className={styles.pane} role="tabpanel" id="filter-drawer-panel" aria-labelledby={`drawer-tab-${current.id}`}>
          <Pane name="drawer" value={draft} counts={counts} options={options} onChange={onChange} unknown={unknown} />
        </div>
      </div>
      <div className={styles.drawerFoot}>
        <button type="button" className="button button--ghost" onClick={onClear}>Clear all</button>
        <button type="button" className="button button--primary" onClick={onApply}>Show {total} {total === 1 ? 'college' : 'colleges'}</button>
      </div>
    </div>}
  </dialog>;
}
