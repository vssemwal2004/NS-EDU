'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatCount, formatOf, MAX_FILE_BYTES, TEMPLATE_URL, uploadText } from './data-api';
import styles from './DataOps.module.css';
import form from '../ResourceManager.module.css';

const COLUMNS = ['name*', 'city*', 'state', 'website', 'slug', 'shortName', 'aliases', 'type', 'category', 'ownership', 'establishedYear', 'admissionUrl', 'email', 'phone', 'address', 'district', 'pincode', 'affiliatedTo', 'approvals', 'naacGrade', 'nirfRank', 'nirfYear', 'streams', 'courseSlugs', 'coursesOffered', 'about', 'logoUrl', 'coverUrl', 'sourceUrl'];
const sizeOf = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Summary({ result }) {
  const rows = [['Rows', result.rows], [result.dryRun ? 'Would add' : 'Added', result.inserted], [result.dryRun ? 'Would update' : 'Updated', result.updated], ['Unchanged', result.unchanged], ['Rejected', result.failed, 'bad']];
  return <dl className={styles.summary}>{rows.map(([label, value, tone]) => <div key={label} data-tone={tone && value ? tone : undefined}><dt>{label}</dt><dd>{formatCount(value)}</dd></div>)}</dl>;
}

function Errors({ result, format }) {
  if (!result.errors?.length) return null;
  const rowOf = (index) => (format === 'csv' ? `Row ${index + 2}` : `Item ${index + 1}`);
  return <div className={form.tableCard}><div className={form.tableScroll}>
    <table className={form.table} style={{ minWidth: 520 }}>
      <caption className="sr-only">Rows that cannot be imported</caption>
      <thead><tr><th scope="col">Row</th><th scope="col">Name</th><th scope="col">Problem</th></tr></thead>
      <tbody>{result.errors.slice(0, 25).map((error) => <tr key={error.index}>
        <td className={styles.nowrap}>{rowOf(error.index)}</td><td>{error.name || '—'}</td>
        <td>{Object.entries(error.errors).map(([field, message]) => <div key={field}><strong>{field}</strong>: {message}</div>)}</td>
      </tr>)}</tbody>
    </table>
  </div>{result.errors.length > 25 && <p className={form.pagination}>Showing 25 of {formatCount(result.failed)} rejected rows.</p>}</div>;
}

export default function ImportUniversities() {
  const [file, setFile] = useState(null);
  const [options, setOptions] = useState({ sourceName: '', sourceUrl: '', publish: false });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [inputKey, setInputKey] = useState(0);

  async function choose(selected) {
    setPreview(null); setResult(null); setError('');
    if (!selected) { setFile(null); return; }
    const format = formatOf(selected);
    if (!format) { setFile(null); setError('Choose a .csv or .json file.'); return; }
    if (selected.size > MAX_FILE_BYTES) { setFile(null); setError(`This file is ${sizeOf(selected.size)}. Files are limited to 5 MB (about 5,000 rows); split it into parts.`); return; }
    setFile({ name: selected.name, size: selected.size, format, text: await selected.text() });
  }

  function setOption(key, value) {
    setOptions((previous) => ({ ...previous, [key]: value }));
    setPreview(null); setResult(null);
  }

  async function run(dryRun) {
    setBusy(dryRun ? 'check' : 'import'); setError('');
    try {
      const data = await uploadText('/universities/import', file.text, {
        format: file.format, dryRun: String(dryRun), publish: String(options.publish),
        ...(options.sourceName.trim() && { sourceName: options.sourceName.trim() }), ...(options.sourceUrl.trim() && { sourceUrl: options.sourceUrl.trim() }),
      });
      if (dryRun) setPreview(data); else { setResult(data); setPreview(null); }
    } catch (failure) { setError(failure.message); }
    setBusy('');
  }

  const importable = preview ? preview.inserted + preview.updated : 0;
  return <div className={styles.page}>
    <div className={styles.intro}>
      <p>Add or update universities from a spreadsheet or JSON export, for example a list downloaded from an official directory. Rows are matched to existing records by slug, then website and name, then name and state. Fields an administrator has edited are never overwritten.</p>
      <div className={styles.actions}><a className="button button--ghost" href={TEMPLATE_URL} download><Icon name="document" />CSV template</a></div>
    </div>

    <ol className={styles.steps}>
      <li className={styles.step} data-done={Boolean(file)}><div className={`${styles.card} ${styles.stepBody}`}>
        <h2>Choose a file</h2>
        <label className={styles.drop}>
          <Icon name="document" />
          <input key={inputKey} type="file" accept=".csv,.json,.tsv,.txt,text/csv,application/json" onChange={(event) => choose(event.target.files?.[0])} />
          {file ? <><strong>{file.name}</strong><span>{file.format.toUpperCase()} · {sizeOf(file.size)} · choose another file to replace it</span></> : <><strong>Select a CSV or JSON file</strong><span>Up to 5 MB and 5,000 rows. The file is read in your browser and sent as text.</span></>}
        </label>
        <details className={styles.details}>
          <summary>Expected columns</summary>
          <div>
            <p>Use the field names below as the header row (<span className={styles.inlineCode}>name</span> and <span className={styles.inlineCode}>city</span> are required). Unknown columns are ignored. JSON files use the same names as keys, as an array of objects.</p>
            <div className={styles.fieldList}>{COLUMNS.map((column) => <span key={column} className={styles.chip}>{column}</span>)}</div>
            <p>List fields (aliases, approvals, streams, courseSlugs, coursesOffered) hold several values in one quoted cell, separated by semicolons, or by commas when no value contains a comma. <span className={styles.inlineCode}>sourceUrl</span> is the page the row came from.</p>
          </div>
        </details>
      </div></li>

      <li className={styles.step} data-done={Boolean(preview || result)}><div className={`${styles.card} ${styles.stepBody}`}>
        <h2>Check the file</h2>
        <div className={styles.options}>
          <div className={form.formField}><label className={form.fieldLabel} htmlFor="import-source">Source name</label><input id="import-source" className={form.input} maxLength={120} placeholder="e.g. Directory download, Oct 2026" value={options.sourceName} onChange={(event) => setOption('sourceName', event.target.value)} /></div>
          <div className={form.formField}><label className={form.fieldLabel} htmlFor="import-url">Source link</label><input id="import-url" className={form.input} type="url" inputMode="url" maxLength={500} placeholder="https://" value={options.sourceUrl} onChange={(event) => setOption('sourceUrl', event.target.value)} /></div>
          <label className={styles.check}><input type="checkbox" checked={options.publish} onChange={(event) => setOption('publish', event.target.checked)} /><span>Show new records to students straight away (still marked unverified). Leave off to hold them for review.</span></label>
        </div>
        <div className={styles.actions}><button type="button" className="button button--outline" disabled={!file || Boolean(busy)} onClick={() => run(true)}>{busy === 'check' ? 'Checking…' : 'Check file (dry run)'}</button></div>
        {preview && <>
          <Summary result={preview} />
          {preview.ignoredColumns?.length > 0 && <p className={styles.muted}>Ignored columns: {preview.ignoredColumns.join(', ')}</p>}
          <Errors result={preview} format={file?.format} />
        </>}
      </div></li>

      <li className={styles.step} data-done={Boolean(result)}><div className={`${styles.card} ${styles.stepBody}`}>
        <h2>Import</h2>
        {!result && <p>{preview ? `${formatCount(importable)} of ${formatCount(preview.rows)} rows will be written${preview.failed ? `; ${formatCount(preview.failed)} rejected rows are skipped` : ''}. New records are ${options.publish ? 'visible to students' : 'held for review'}.` : 'Run the check first. Nothing is written until you import.'}</p>}
        {!result && <div className={styles.actions}><button type="button" className="button button--primary" disabled={!preview || !importable || Boolean(busy)} onClick={() => run(false)}>{busy === 'import' ? 'Importing…' : preview ? `Import ${formatCount(importable)} record${importable === 1 ? '' : 's'}` : 'Import records'}</button></div>}
        {result && <>
          <Summary result={result} />
          <Errors result={result} format={file?.format} />
          <div className={styles.actions}>
            <Link className="button button--primary" href={`/admin/data/review?view=${options.publish ? 'visible' : 'held'}&source=import`}>Review imported records</Link>
            <button type="button" className="button button--ghost" onClick={() => { setFile(null); setPreview(null); setResult(null); setInputKey((key) => key + 1); }}>Import another file</button>
          </div>
        </>}
      </div></li>
    </ol>
    {error && <p className={form.formError} role="alert"><Icon name="shield" />{error}</p>}
  </div>;
}
