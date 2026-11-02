'use client';
// Import › Universities: upload → dry-run report → apply. Nothing is written until the last step.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Panel, StatStrip } from '../ui/Page';
import { formatCount, formatOf, MAX_FILE_BYTES, TEMPLATE_URL, uploadText } from './data-api';
import styles from '../catalogue/Catalogue.module.css';

const COLUMNS = ['name*', 'city*', 'state', 'website', 'slug', 'shortName', 'aliases', 'type', 'category', 'ownership', 'establishedYear', 'admissionUrl', 'email', 'phone', 'address', 'district', 'pincode', 'affiliatedTo', 'approvals', 'naacGrade', 'nirfRank', 'nirfYear', 'streams', 'courseSlugs', 'coursesOffered', 'about', 'logoUrl', 'coverUrl', 'sourceUrl'];
const sizeOf = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const STEPS = [['upload', 'Choose a file', 'CSV or JSON, up to 5 MB'], ['check', 'Check (dry run)', 'See what would change'], ['apply', 'Import', 'Write the records']];

function Report({ result, format }) {
  const rowOf = (index) => (format === 'csv' ? `Row ${index + 2}` : `Item ${index + 1}`);
  return <>
    <StatStrip label={result.dryRun ? 'Dry run result' : 'Import result'} items={[
      { key: 'rows', label: 'Rows in file', value: result.rows, icon: 'document' },
      { key: 'insert', label: result.dryRun ? 'Would add' : 'Added', value: result.inserted, icon: 'plus', tone: 'good' },
      { key: 'update', label: result.dryRun ? 'Would update' : 'Updated', value: result.updated, icon: 'edit', tone: 'info' },
      { key: 'same', label: 'Unchanged', value: result.unchanged, icon: 'check' },
      { key: 'failed', label: 'Rejected', value: result.failed, icon: 'alert', tone: result.failed ? 'bad' : undefined },
    ]} />
    {result.ignoredColumns?.length > 0 && <p className={styles.info}><Icon name="alert" /><span>Ignored columns (not in the template): <strong>{result.ignoredColumns.join(', ')}</strong></span></p>}
    {result.errors?.length > 0 && <div className={styles.miniScroll}><table className={styles.miniTable} style={{ fontSize: 'var(--crm-text-sm)' }}>
      <caption className="sr-only">Rows that cannot be imported</caption>
      <thead><tr><th scope="col" style={{ width: 90 }}>Row</th><th scope="col">Name</th><th scope="col">Problem</th></tr></thead>
      <tbody>{result.errors.slice(0, 25).map((error) => <tr key={error.index}>
        <td>{rowOf(error.index)}</td><td><span className={styles.truncate} title={error.name}>{error.name || '—'}</span></td>
        <td>{Object.entries(error.errors).map(([field, message]) => <div key={field}><strong>{field}</strong>: {message}</div>)}</td>
      </tr>)}</tbody>
    </table>{result.errors.length > 25 && <p className={styles.note} style={{ padding: 8 }}>Showing 25 of {formatCount(result.failed)} rejected rows.</p>}</div>}
  </>;
}

export default function ImportUniversities() {
  const [file, setFile] = useState(null);
  const [options, setOptions] = useState({ sourceName: '', sourceUrl: '', publish: false });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const step = result ? 'apply' : preview ? 'check' : 'upload';

  async function choose(selected) {
    setPreview(null); setResult(null); setError('');
    if (!selected) { setFile(null); return; }
    const format = formatOf(selected);
    if (!format) { setFile(null); setError('Choose a .csv or .json file.'); return; }
    if (selected.size > MAX_FILE_BYTES) { setFile(null); setError(`This file is ${sizeOf(selected.size)}. Files are limited to 5 MB (about 5,000 rows); split it into parts.`); return; }
    setFile({ name: selected.name, size: selected.size, format, text: await selected.text() });
  }
  const setOption = (key, value) => { setOptions((previous) => ({ ...previous, [key]: value })); setPreview(null); setResult(null); };

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
  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(''); setInputKey((key) => key + 1); };

  const importable = preview ? preview.inserted + preview.updated : 0;
  const index = STEPS.findIndex(([key]) => key === step);
  return <>
    <ol className={styles.stepper} aria-label="Import steps">
      {STEPS.map(([key, label, hint], position) => <li key={key} aria-current={key === step ? 'step' : undefined} data-done={position < index || (key === 'apply' && result) || undefined}>
        <span className={styles.stepNumber}>{position < index || (key === 'apply' && result) ? <Icon name="check" /> : position + 1}</span>
        <span>{label}<small>{hint}</small></span>
      </li>)}
    </ol>
    {error && <p className={styles.alert} role="alert"><Icon name="alert" />{error}</p>}

    {step === 'upload' && <Panel title="Choose a file" actions={<a className="adm-btn adm-btn--sm" href={TEMPLATE_URL} download><Icon name="download" />CSV template</a>}>
      <label className={styles.drop}>
        <Icon name="upload" />
        <input key={inputKey} type="file" accept=".csv,.json,.tsv,.txt,text/csv,application/json" onChange={(event) => choose(event.target.files?.[0])} />
        {file ? <><strong>{file.name}</strong><span>{file.format.toUpperCase()} · {sizeOf(file.size)} · choose another file to replace it</span></> : <><strong>Select a CSV or JSON file</strong><span>Up to 5 MB and 5,000 rows. Rows match existing records by slug, then website and name, then name and state.</span></>}
      </label>
      <details className={styles.details}>
        <summary>Expected columns</summary>
        <div>
          <p>Header row uses the field names below (<code>name</code> and <code>city</code> are required); unknown columns are ignored. List fields (aliases, approvals, streams, courseSlugs, coursesOffered) hold several values separated by semicolons. Fields an administrator edited are never overwritten.</p>
          <div className={styles.columnList}>{COLUMNS.map((column) => <code key={column}>{column}</code>)}</div>
        </div>
      </details>
      <div className={styles.formGrid} style={{ marginTop: 12 }}>
        <label className="adm-label">Source name<input className="adm-input" maxLength={120} placeholder="e.g. Directory download, Oct 2026" value={options.sourceName} onChange={(event) => setOption('sourceName', event.target.value)} /></label>
        <label className="adm-label">Source link<input className="adm-input" type="url" inputMode="url" maxLength={500} placeholder="https://" value={options.sourceUrl} onChange={(event) => setOption('sourceUrl', event.target.value)} /></label>
      </div>
      <label className={styles.check} style={{ marginTop: 10 }}><input type="checkbox" checked={options.publish} onChange={(event) => setOption('publish', event.target.checked)} /><span>Show new records to students straight away (still marked unverified). Leave off to hold them for review.</span></label>
      <div className={styles.actionsRow} data-end>
        <button type="button" className="adm-btn adm-btn--primary" disabled={!file || Boolean(busy)} onClick={() => run(true)}><Icon name="search" />{busy === 'check' ? 'Checking…' : 'Check file (dry run)'}</button>
      </div>
    </Panel>}

    {step === 'check' && <Panel title={`Dry run: ${file?.name}`} description="Nothing has been written yet.">
      <Report result={preview} format={file?.format} />
      <p className={styles.note} style={{ marginTop: 10 }}>{formatCount(importable)} of {formatCount(preview.rows)} rows will be written{preview.failed ? `; ${formatCount(preview.failed)} rejected rows are skipped` : ''}. New records are {options.publish ? 'visible to students' : 'held for review'}.</p>
      <div className={styles.actionsRow} data-end>
        <button type="button" className="adm-btn adm-btn--ghost" disabled={Boolean(busy)} onClick={() => setPreview(null)}>Back</button>
        <button type="button" className="adm-btn adm-btn--primary" disabled={!importable || Boolean(busy)} onClick={() => run(false)}><Icon name="upload" />{busy === 'import' ? 'Importing…' : `Import ${formatCount(importable)} record${importable === 1 ? '' : 's'}`}</button>
      </div>
    </Panel>}

    {step === 'apply' && <Panel title="Import finished">
      <Report result={result} format={file?.format} />
      <div className={styles.actionsRow} data-end>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={reset}>Import another file</button>
        <Link className="adm-btn adm-btn--primary" href={`/admin/data/review?view=${options.publish ? 'visible' : 'held'}&source=import`}>Review imported records</Link>
      </div>
    </Panel>}
  </>;
}
