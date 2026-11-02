'use client';
// Layout primitives every admin screen uses, so screens look and behave the same.
// The shell already renders the page title, description and section tabs; screens start with a toolbar.
//
//   <PageToolbar summary="1,200 leads · 64 today">            left: a one-line summary (or search/filters)
//     <button className="adm-btn">Filters</button>              right: actions, primary action last
//     <button className="adm-btn adm-btn--primary">Add lead</button>
//   </PageToolbar>
//   <StatStrip items={[{ key: 'hot', label: 'Hot', value: 198, tone: 'bad', icon: 'flame', onClick, active }]} />
//   <ViewTabs label="Quick views" value={view} onChange={setView} items={[{ key: 'all', label: 'All', count: 1200 }]} />
//   <Panel title="Team" description="…" actions={…}>…</Panel>
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Page.module.css';

const fmt = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : value);

export function PageToolbar({ summary, start, children, sticky = false }) {
  return <div className={styles.toolbar} data-sticky={sticky || undefined}>
    <div className={styles.toolbarStart}>{summary && <p className={styles.summary}>{summary}</p>}{start}</div>
    {children && <div className={styles.toolbarEnd}>{children}</div>}
  </div>;
}

/** One compact row of numbers (replaces rows of big KPI cards). Items with onClick/href act as filters.
 *  Label first, then the number; colour only when the number needs attention (bad/warn tone and not zero). */
export function StatStrip({ items, label = 'Summary', loading = false }) {
  return <ul className={styles.stats} aria-label={label}>
    {items.filter(Boolean).map((item) => {
      const attention = (item.tone === 'bad' || item.tone === 'warn') && Number(item.value) > 0;
      const body = <>
        <span className={styles.statLabel}>{item.icon && <Icon name={item.icon} />}<span>{item.label}</span></span>
        <strong className={`${styles.statValue} crm-tabnum`} data-tone={attention ? item.tone : undefined}>{loading ? <span className={styles.skeleton} /> : fmt(item.value)}</strong>
      </>;
      return <li key={item.key} className={styles.stat} data-active={item.active || undefined}>
        {item.href ? <Link href={item.href} className={styles.statButton}>{body}</Link>
          : item.onClick ? <button type="button" className={styles.statButton} aria-pressed={Boolean(item.active)} onClick={item.onClick}>{body}</button>
            : <div className={styles.statButton}>{body}</div>}
      </li>;
    })}
  </ul>;
}

/** Segmented in-page views (quick views, internal tabs). Scrolls sideways instead of wrapping. */
export function ViewTabs({ items, value, onChange, label }) {
  const shown = items.filter(Boolean);
  // WAI-ARIA tabs: ← → Home End move and select (roving tabindex).
  const onKey = (event) => {
    const at = shown.findIndex((item) => item.key === value);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shown.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = shown[(next + shown.length) % shown.length];
    onChange(target.key);
    [...event.currentTarget.querySelectorAll('[role="tab"]')].find((node) => node.dataset.key === String(target.key))?.focus();
  };
  return <div className={styles.views} role="tablist" aria-label={label} onKeyDown={onKey}>
    {shown.map((item) => <button key={item.key} type="button" role="tab" aria-selected={item.key === value} className={styles.view}
      data-key={item.key} tabIndex={item.key === value ? 0 : -1} onClick={() => onChange(item.key)}>
      {item.icon && <Icon name={item.icon} />}<span>{item.label}</span>
      {item.count !== undefined && item.count !== null && <span className={`${styles.viewCount} crm-tabnum`}>{fmt(item.count)}</span>}
    </button>)}
  </div>;
}

/** `meta` = a short line of data shown next to the title ("3 overdue · 2 today").
 *  `description` = what the panel is for: a short data line stays visible; an explanatory sentence moves into
 *  an ⓘ hint so panels do not stack grey paragraphs. */
export function Panel({ title, description, meta, actions, children, flush = false, className, as: Tag = 'section' }) {
  const inline = meta ?? (description && (typeof description !== 'string' || (/\d/.test(description) && description.length <= 80)) ? description : null);
  const hint = typeof description === 'string' && description !== inline ? description : null;
  return <Tag className={['adm-panel', styles.panel, className].filter(Boolean).join(' ')}>
    {(title || actions) && <header className={styles.panelHead}>
      <div className={styles.panelTitle}>
        {title && <h2>{title}</h2>}
        {hint && <span className={styles.hint} tabIndex={0} role="note" aria-label={hint} data-tip={hint}>i</span>}
        {inline && <p>{inline}</p>}
      </div>
      {actions && <div className={styles.panelActions}>{actions}</div>}
    </header>}
    <div className={flush ? undefined : styles.panelBody}>{children}</div>
  </Tag>;
}
