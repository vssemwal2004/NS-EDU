'use client';
import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Table.module.css';

const keyOf = (row, rowKey) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]);
const SKELETON_WIDTHS = ['72%', '54%', '86%', '62%', '44%'];

/**
 * Server-paged table. Columns are [{ key, label, width?, className? }]; cells come from
 * renderCell(row, column) (default: row[column.key]). On phones each row becomes a card and every
 * cell is labelled from its column. `pageSize` sets how many skeleton rows the first load shows;
 * a new `scrollKey` (e.g. the page number) scrolls the table back to its first row.
 */
export default function DataTable({
  columns, rows = [], rowKey = 'id', loading = false, busy = false, pageSize = 10, caption, empty, error = '', onRetry,
  scrollKey, selectable = false, selectedIds = [], onSelectionChange, renderCell = (row, column) => row[column.key], rowLabel = (row) => keyOf(row, rowKey),
}) {
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [scrollKey]);
  const ids = rows.map((row) => keyOf(row, rowKey));
  const chosen = new Set(selectedIds);
  const all = ids.length > 0 && ids.every((id) => chosen.has(id));
  const some = ids.some((id) => chosen.has(id));
  const toggle = (id, on) => onSelectionChange?.(on ? [...selectedIds.filter((item) => item !== id), id] : selectedIds.filter((item) => item !== id));

  if (error) return <div className={styles.state} role="alert">
    <Icon name="shield" /><p>{error}</p>
    {onRetry && <button type="button" className="button button--outline" onClick={onRetry}>Try again</button>}
  </div>;

  const skeleton = loading && !rows.length;
  return <div ref={scroller} className={styles.scroll} data-busy={busy || undefined}>
    <table className={styles.table} aria-busy={loading || busy}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr>
        {selectable && <th scope="col" className={styles.checkCell}>
          <input type="checkbox" aria-label="Select all rows on this page" checked={all} disabled={!ids.length}
            ref={(node) => { if (node) node.indeterminate = some && !all; }}
            onChange={(event) => onSelectionChange?.(event.target.checked ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.includes(id)))} />
        </th>}
        {columns.map((column) => <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>{column.label}</th>)}
      </tr></thead>
      <tbody>
        {skeleton ? Array.from({ length: pageSize }, (_, index) => <tr key={index} className={styles.skeletonRow} aria-hidden="true">
          {selectable && <td className={styles.checkCell}><span /></td>}
          {columns.map((column, cell) => <td key={column.key}><span style={{ width: SKELETON_WIDTHS[(index + cell) % SKELETON_WIDTHS.length] }} /></td>)}
        </tr>) : rows.map((row) => {
          const id = keyOf(row, rowKey);
          return <tr key={id} data-selected={chosen.has(id) || undefined}>
            {selectable && <td className={styles.checkCell}>
              <input type="checkbox" aria-label={`Select ${rowLabel(row)}`} checked={chosen.has(id)} onChange={(event) => toggle(id, event.target.checked)} />
            </td>}
            {columns.map((column) => <td key={column.key} data-label={column.label} className={column.className}>{renderCell(row, column)}</td>)}
          </tr>;
        })}
      </tbody>
    </table>
    {skeleton && <p className="sr-only" role="status">Loading…</p>}
    {!loading && !rows.length && <div className={styles.state}>{empty ?? <><Icon name="search" /><p>Nothing to show.</p></>}</div>}
  </div>;
}
