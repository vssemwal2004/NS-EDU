'use client';
import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Table.module.css';

const number = (value) => value.toLocaleString('en-IN');

/** Page buttons around `current`: 1 … 4 5 6 … last. */
export function pageItems(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  const start = Math.max(2, Math.min(current - 1, last - 4));
  const end = Math.min(last - 1, Math.max(current + 1, 5));
  return [1, ...(start > 2 ? ['…'] : []), ...Array.from({ length: end - start + 1 }, (_, index) => start + index), ...(end < last - 1 ? ['…'] : []), last];
}

/**
 * Numbered pages work within `maxSkip` rows (the server's skip limit). Past that only Previous/Next
 * work, through `onPrevious`/`onNext` (keyset cursors). `total` may be null when the count timed out.
 */
export default function Pagination({
  page, pageSize, pageSizes = [25, 50, 100], total, totalExact = true, rowCount = 0, hasNext, hasPrevious, maxSkip = Infinity,
  onPage, onPageSize, onNext, onPrevious, disabled = false, noun = 'rows',
}) {
  const id = useId();
  const [jump, setJump] = useState('');
  const lastPage = typeof total === 'number' ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const reachable = Math.floor(maxSkip / pageSize) + 1;
  const lastNumbered = lastPage === null ? Math.min(reachable, page + (hasNext ? 1 : 0)) : Math.min(lastPage, reachable);
  const deep = lastPage === null || lastPage > reachable;
  const from = rowCount ? (page - 1) * pageSize + 1 : 0;
  const to = rowCount ? from + rowCount - 1 : 0;
  const go = (target) => { if (target >= 1 && target <= reachable) onPage(target); };
  const previous = () => (page - 1 <= reachable ? go(page - 1) : onPrevious?.());
  const next = () => (page + 1 <= reachable ? go(page + 1) : onNext?.());
  const items = page <= reachable ? pageItems(page, lastNumbered) : [1, '…', page];
  const showLast = lastPage !== null && lastPage <= reachable;

  function submitJump(event) {
    event.preventDefault();
    const target = Number.parseInt(jump, 10);
    if (Number.isFinite(target)) go(Math.min(Math.max(1, target), lastNumbered));
    setJump('');
  }

  return <nav className={styles.pagination} aria-label="Pagination">
    <div className={styles.pageMeta}>
      <label className={styles.pageSize} htmlFor={`${id}-size`}>Rows per page
        <select id={`${id}-size`} value={pageSize} disabled={disabled} onChange={(event) => onPageSize(Number(event.target.value))}>
          {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span aria-live="polite">{rowCount ? `Showing ${number(from)}–${number(to)} of ${total === null || total === undefined ? 'many' : `${number(total)}${totalExact ? '' : '+'}`}` : `No ${noun}`}</span>
    </div>
    <div className={styles.pageControls}>
      <button type="button" className={styles.pageButton} disabled={disabled || page <= 1} onClick={() => go(1)}>First</button>
      <button type="button" className={styles.pageButton} disabled={disabled || !hasPrevious || page <= 1} onClick={previous} aria-label="Previous page"><Icon name="arrow" className={styles.flip} /></button>
      <ol className={styles.pageList}>
        {items.map((item, index) => <li key={`${item}-${index}`}>
          {item === '…' ? <span className={styles.ellipsis} aria-hidden="true">…</span>
            : <button type="button" className={styles.pageNumber} aria-current={item === page ? 'page' : undefined} disabled={disabled || item > reachable} onClick={() => go(item)}
              aria-label={`Page ${number(item)}`}>{number(item)}</button>}
        </li>)}
      </ol>
      <button type="button" className={styles.pageButton} disabled={disabled || !hasNext} onClick={next} aria-label="Next page"><Icon name="arrow" /></button>
      <button type="button" className={styles.pageButton} disabled={disabled || !showLast || page >= lastPage} onClick={() => go(lastPage)}
        title={showLast ? undefined : 'Narrow the filters to jump to the last page'}>Last</button>
      {lastNumbered > 7 && <form className={styles.jump} onSubmit={submitJump}>
        <label htmlFor={`${id}-jump`}>Go to</label>
        <input id={`${id}-jump`} type="number" inputMode="numeric" min={1} max={lastNumbered} value={jump} disabled={disabled}
          placeholder={String(page)} onChange={(event) => setJump(event.target.value)} />
      </form>}
    </div>
    {deep && rowCount > 0 && <p className={styles.pageHint}>Page numbers reach {number(reachable * pageSize)} rows. Narrow filters to jump further; Next and Previous keep working.</p>}
  </nav>;
}
