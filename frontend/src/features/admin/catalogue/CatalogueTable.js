'use client';
// Dense list table for the catalogue and data-pipeline screens. Fixed layout so default columns fit 1280px
// without a horizontal scrollbar (long text truncates with a title); the header sticks under the top bar;
// a row click opens the record; below 760px rows become labelled cards.
// columns: [{ key, label, width?, align?: 'end', render(row) }]
import { EmptyState, ErrorState } from './CatalogueParts';
import styles from './CatalogueTable.module.css';

const SKELETON = ['72%', '54%', '86%', '62%', '44%'];
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menu"], [role="menuitem"]';

export default function CatalogueTable({
  columns, rows = [], rowKey = 'id', loading = false, busy = false, error = '', onRetry, empty, caption, pageSize = 15,
  selectable = false, selected = [], onSelectionChange, onRowClick, rowLabel = (row) => row[rowKey], rowMuted, stickyOffset = 0,
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const ids = rows.map((row) => row[rowKey]);
  const chosen = new Set(selected);
  const all = ids.length > 0 && ids.every((id) => chosen.has(id));
  const some = ids.some((id) => chosen.has(id));
  const skeleton = loading && !rows.length;
  const toggle = (id, on) => onSelectionChange?.(on ? [...selected.filter((item) => item !== id), id] : selected.filter((item) => item !== id));

  return <div className={styles.wrap} data-busy={busy || undefined} style={{ '--sticky-offset': `${stickyOffset}px` }}>
    <table className={styles.table} aria-busy={loading || busy}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <colgroup>
        {selectable && <col style={{ width: 36 }} />}
        {columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
      </colgroup>
      <thead><tr>
        {selectable && <th scope="col" className={styles.check}>
          <input type="checkbox" aria-label="Select all rows on this page" checked={all} disabled={!ids.length}
            ref={(node) => { if (node) node.indeterminate = some && !all; }}
            onChange={(event) => onSelectionChange?.(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} />
        </th>}
        {columns.map((column) => <th key={column.key} scope="col" data-align={column.align}>{column.label ? column.label : <span className="sr-only">{column.srLabel ?? 'Actions'}</span>}</th>)}
      </tr></thead>
      <tbody>
        {skeleton ? Array.from({ length: pageSize }, (_, index) => <tr key={index} className={styles.skeleton} aria-hidden="true">
          {selectable && <td className={styles.check}><span /></td>}
          {columns.map((column, cell) => <td key={column.key}><span style={{ width: SKELETON[(index + cell) % SKELETON.length] }} /></td>)}
        </tr>) : rows.map((row) => {
          const id = row[rowKey];
          return <tr key={id} data-selected={chosen.has(id) || undefined} data-muted={rowMuted?.(row) || undefined} data-clickable={onRowClick ? true : undefined}
            onClick={onRowClick ? (event) => { if (!event.target.closest(INTERACTIVE) && !window.getSelection()?.toString()) onRowClick(row); } : undefined}>
            {selectable && <td className={styles.check}>
              <input type="checkbox" aria-label={`Select ${rowLabel(row)}`} checked={chosen.has(id)} onChange={(event) => toggle(id, event.target.checked)} />
            </td>}
            {columns.map((column) => <td key={column.key} data-label={column.label || undefined} data-align={column.align}>{column.render(row)}</td>)}
          </tr>;
        })}
      </tbody>
    </table>
    {skeleton && <p className="sr-only" role="status">Loading</p>}
    {!loading && !rows.length && (empty ?? <EmptyState icon="search" title="Nothing to show." />)}
  </div>;
}

/** A column header-less ⋮ cell keeps its width small. */
export const ACTIONS_COLUMN = { key: 'actions', label: '', width: 44, align: 'end' };
