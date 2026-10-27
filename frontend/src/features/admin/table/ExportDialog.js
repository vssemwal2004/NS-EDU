'use client';
import { useEffect, useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import { toQuery } from './useServerList';
import styles from './Table.module.css';

const number = (value) => value.toLocaleString('en-IN');
const FORMAT_NOTES = { csv: 'Any number of rows. Opens in Excel and Google Sheets.', xlsx: 'Formatted spreadsheet with a frozen header row.', pdf: 'Printable landscape table.' };
function limitText(format) {
  const parts = [format.maxRows ? `up to ${number(format.maxRows)} rows` : 'no row limit', format.maxColumns ? `${format.maxColumns} columns` : ''].filter(Boolean);
  return parts.join(' · ');
}

// Same-origin link, so the admin session cookie authorises the download and the browser streams it to disk.
function startDownload(href) {
  const link = document.createElement('a');
  link.href = href;
  link.download = '';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}

function Body({ request, checkPath, downloadPath, columns, visibleKeys, formats, params, noun, onDone }) {
  const id = useId();
  const [format, setFormat] = useState(formats[0]?.value ?? 'csv');
  const [keys, setKeys] = useState(visibleKeys);
  const [check, setCheck] = useState({ query: '', data: null, error: '' });
  const spec = formats.find((item) => item.value === format) ?? {};
  const query = toQuery({ ...params, format, columns: keys });

  useEffect(() => {
    if (!keys.length) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      request(`${checkPath}?${query}`, { signal: controller.signal })
        .then((data) => setCheck({ query, data, error: '' }))
        .catch((failure) => { if (failure.name !== 'AbortError') setCheck({ query, data: null, error: failure.message }); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [checkPath, keys.length, query, request]);

  const checked = check.query === query ? check : null;
  const total = checked?.data?.total;
  // Only capped formats need an exact count; an uncapped one (CSV) downloads even when counting timed out.
  const tooManyRows = Boolean(checked?.data) && Boolean(spec.maxRows) && (total === null || total > spec.maxRows);
  const tooManyColumns = Boolean(spec.maxColumns) && keys.length > spec.maxColumns;
  const ready = Boolean(checked?.data?.ok) && keys.length > 0 && !tooManyRows && !tooManyColumns && (total > 0 || (total === null && !spec.maxRows));
  const rowsText = total === null ? `many ${noun.many}` : `${number(total)} ${total === 1 ? noun.one : noun.many}`;
  const toggle = (key, on) => setKeys((current) => (on ? [...current.filter((item) => item !== key), key] : current.filter((item) => item !== key)));
  const groups = [...columns.reduce((map, column) => map.set(column.group, [...(map.get(column.group) ?? []), column]), new Map())];

  function download(event) {
    event.preventDefault();
    if (!ready) return;
    startDownload(`${downloadPath}?${query}`);
    onDone?.(`${spec.label ?? 'File'} download started (${rowsText}).`);
  }

  return <form className={styles.filterForm} onSubmit={download}>
    <fieldset className={styles.filterSection}>
      <legend>Format</legend>
      <div className={styles.formatCards}>
        {formats.map((item) => <label key={item.value} className={styles.formatCard} data-active={item.value === format || undefined}>
          <input type="radio" name={`${id}-format`} value={item.value} checked={item.value === format} onChange={() => setFormat(item.value)} />
          <Icon name={item.value === 'pdf' ? 'document' : item.value === 'xlsx' ? 'dashboard' : 'layers'} />
          <strong>{item.label}</strong>
          <small>{FORMAT_NOTES[item.value] ?? ''}</small>
          <small className={styles.formatLimit}>{limitText(item)}</small>
        </label>)}
      </div>
    </fieldset>

    <div className={styles.exportSummary} aria-live="polite">
      {!keys.length ? <p className={drawerStyles.fieldError}>Choose at least one column.</p>
        : !checked ? <p className={styles.counting}>Counting matching {noun.many}…</p>
          : checked.error ? <p className={drawerStyles.formError} role="alert"><Icon name="shield" />{checked.error}</p>
            : <>
              <p><strong>{total === null ? `Too many ${noun.many} to count quickly` : rowsText}</strong> · {keys.length} {keys.length === 1 ? 'column' : 'columns'} · {spec.label}</p>
              {total === 0 && <p className={styles.warning}><Icon name="shield" />No {noun.many} match these filters, so there is nothing to download.</p>}
              {total === null && !spec.maxRows && <p className={styles.counting}>Large exports can take a few minutes; the file streams as it is written.</p>}
              {tooManyRows && <p className={styles.warning}><Icon name="shield" />{total === null
                ? `${spec.label} needs an exact count. Narrow the filters or the date range, or choose CSV.`
                : `${spec.label} exports at most ${number(spec.maxRows)} rows. Narrow the filters or choose CSV.`}</p>}
              {tooManyColumns && <p className={styles.warning}><Icon name="shield" />{spec.label} fits at most {spec.maxColumns} columns; {keys.length} are chosen. Untick some or choose Excel or CSV.</p>}
            </>}
    </div>

    <fieldset className={styles.filterSection}>
      <legend>Columns <span className={styles.legendCount}>{keys.length}</span></legend>
      <div className={styles.inlineActions}>
        <button type="button" className={styles.linkButton} onClick={() => setKeys([...visibleKeys, ...columns.map((column) => column.key).filter((key) => !visibleKeys.includes(key))])}>Select all</button>
        <button type="button" className={styles.linkButton} onClick={() => setKeys([])}>Select none</button>
        <button type="button" className={styles.linkButton} onClick={() => setKeys(visibleKeys)}>Table columns</button>
      </div>
      {groups.map(([group, items]) => <div key={group} className={styles.columnGroup} role="group" aria-label={group}>
        <h3>{group}</h3>
        <div className={styles.checks}>
          {items.map((column) => <label key={column.key}>
            <input type="checkbox" checked={keys.includes(column.key)} onChange={(event) => toggle(column.key, event.target.checked)} />
            <span>{column.label}</span>
          </label>)}
        </div>
      </div>)}
    </fieldset>

    <div className={`${drawerStyles.formActions} ${styles.actions}`}>
      <button type="submit" className="button button--primary" disabled={!ready}><Icon name="arrowUp" className={styles.flipY} />Download {spec.label}</button>
    </div>
  </form>;
}

/**
 * Download dialog: format cards, a column checklist (defaults to the table's columns) and the matching row
 * count from `checkPath`, with each format's limits. `params` are the list's active filters.
 * Admin-only on the server; callers should hide it for other roles.
 */
export default function ExportDialog({
  open, onClose, request, checkPath, downloadPath, columns, visibleKeys, formats, params, noun = { one: 'row', many: 'rows' }, onDone,
}) {
  return <AdminDrawer open={open} onClose={onClose} title="Download" subtitle="Exports use the current filters and search.">
    {open && <Body request={request} checkPath={checkPath} downloadPath={downloadPath} columns={columns} visibleKeys={visibleKeys} formats={formats}
      params={params} noun={noun} onDone={(message) => { onClose(); onDone?.(message); }} />}
  </AdminDrawer>;
}
