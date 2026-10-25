'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { formatCount, formatOf, uploadText } from './data-api';
import styles from './DataOps.module.css';
import form from '../ResourceManager.module.css';

const COLUMNS = ['name*', 'field*', 'slug', 'fullName', 'level', 'icon', 'summary', 'aliases', 'popular', 'order', 'active'];
const COURSE_TEMPLATE_URL = '/api/admin/data-ops/courses/template.csv';

// The course catalogue: the full list of Indian degrees in one click, more courses from a file, and
// relinking every institution's published programmes to the catalogue after courses change.
export default function ImportCourses() {
  const { request } = useAdminSession();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [linked, setLinked] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function choose(selected) {
    setPreview(null); setResult(null); setError('');
    if (!selected) { setFile(null); return; }
    const format = formatOf(selected);
    if (!format) { setFile(null); setError('Choose a .csv or .json file.'); return; }
    if (selected.size > 2 * 1024 * 1024) { setFile(null); setError('Course files are limited to 2 MB.'); return; }
    setFile({ name: selected.name, format, text: await selected.text() });
  }

  async function upload(dryRun) {
    setBusy(dryRun ? 'check' : 'import'); setError('');
    try {
      const data = await uploadText('/courses/import', file.text, { format: file.format, dryRun: String(dryRun) });
      if (dryRun) setPreview(data); else { setResult(data); setPreview(null); }
    } catch (failure) { setError(failure.message); }
    setBusy('');
  }

  async function action(path, label) {
    setBusy(label); setError('');
    try { setLinked(await request(`/data-ops/courses/${path}`, { method: 'POST', body: {} })); } catch (failure) { setError(failure.message); }
    setBusy('');
  }

  const relinked = linked?.relinked ?? (linked?.scanned != null ? linked : null);
  return <section className={styles.page} aria-labelledby="course-catalogue-title">
    <div className={styles.intro}>
      <h2 id="course-catalogue-title">Course catalogue</h2>
      <p>Courses are degrees (B.Tech, MBA, B.Sc Nursing …), not specialisations. Each institution’s published programmes — “B.Tech Computer Science” — are linked to a course by its name, full name or other spellings, which fills the course pages and the course filter with real institutions and their fees.</p>
      <div className={styles.actions}>
        <button type="button" className="button button--primary" disabled={Boolean(busy)} onClick={() => action('sync', 'sync')}>{busy === 'sync' ? 'Adding…' : 'Add all Indian degrees'}</button>
        <button type="button" className="button button--outline" disabled={Boolean(busy)} onClick={() => action('relink', 'relink')}>{busy === 'relink' ? 'Relinking…' : 'Relink institutions'}</button>
        <Link className="button button--ghost" href="/admin/courses">Edit courses</Link>
        <a className="button button--ghost" href={COURSE_TEMPLATE_URL} download><Icon name="document" />Course CSV template</a>
      </div>
      {linked && <dl className={styles.summary}>
        {linked.catalogue && <><div><dt>Courses added</dt><dd>{formatCount(linked.catalogue.added)}</dd></div><div><dt>In catalogue</dt><dd>{formatCount(linked.catalogue.total)}</dd></div></>}
        {relinked && <><div><dt>Institutions relinked</dt><dd>{formatCount(relinked.updated)}</dd></div><div><dt>With courses</dt><dd>{formatCount(relinked.institutionsWithCourses)}</dd></div><div><dt>Programmes linked</dt><dd>{formatCount(relinked.linkedProgrammes)}</dd></div></>}
      </dl>}
    </div>

    <div className={`${styles.card} ${styles.stepBody}`}>
      <h3>Import courses from a file</h3>
      <label className={styles.drop}>
        <Icon name="document" />
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => choose(event.target.files?.[0])} />
        {file ? <><strong>{file.name}</strong><span>{file.format.toUpperCase()} · choose another file to replace it</span></> : <><strong>Select a CSV or JSON file of courses</strong><span>Up to 2,000 courses. A row with the slug of an existing course updates it.</span></>}
      </label>
      <details className={styles.details}>
        <summary>Expected columns</summary>
        <div>
          <div className={styles.fieldList}>{COLUMNS.map((column) => <span key={column} className={styles.chip}>{column}</span>)}</div>
          <p><span className={styles.inlineCode}>level</span> is UG, PG, Diploma or PhD. <span className={styles.inlineCode}>aliases</span> holds other spellings separated by semicolons. The slug is made from the name when left blank.</p>
        </div>
      </details>
      <div className={styles.actions}>
        <button type="button" className="button button--outline" disabled={!file || Boolean(busy)} onClick={() => upload(true)}>{busy === 'check' ? 'Checking…' : 'Check file (dry run)'}</button>
        <button type="button" className="button button--primary" disabled={!preview || !(preview.added + preview.updated) || Boolean(busy)} onClick={() => upload(false)}>{busy === 'import' ? 'Importing…' : 'Import courses'}</button>
      </div>
      {(result ?? preview) && <dl className={styles.summary}>
        <div><dt>Rows</dt><dd>{formatCount((result ?? preview).rows)}</dd></div>
        <div><dt>{result ? 'Added' : 'Would add'}</dt><dd>{formatCount((result ?? preview).added)}</dd></div>
        <div><dt>{result ? 'Updated' : 'Would update'}</dt><dd>{formatCount((result ?? preview).updated)}</dd></div>
        <div data-tone={(result ?? preview).failed ? 'bad' : undefined}><dt>Rejected</dt><dd>{formatCount((result ?? preview).failed)}</dd></div>
        {result?.relinked && <div><dt>Institutions relinked</dt><dd>{formatCount(result.relinked.updated)}</dd></div>}
      </dl>}
      {(result ?? preview)?.errors?.length > 0 && <ul className={styles.muted}>
        {(result ?? preview).errors.slice(0, 10).map((row) => <li key={row.row}>Row {row.row} {row.name}: {Object.entries(row.errors).map(([field, message]) => `${field} — ${message}`).join('; ')}</li>)}
      </ul>}
    </div>
    {error && <p className={form.formError} role="alert"><Icon name="shield" />{error}</p>}
  </section>;
}
