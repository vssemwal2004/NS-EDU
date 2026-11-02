'use client';
// Import › Courses: the full list of Indian degrees in one click, more courses from a file (dry run first),
// and relinking every institution's published programmes to the catalogue after courses change.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import ConfirmDialog from '../crm/ConfirmDialog';
import { Panel, StatStrip } from '../ui/Page';
import { formatCount, formatOf, uploadText } from './data-api';
import styles from '../catalogue/Catalogue.module.css';

const COLUMNS = ['name*', 'field*', 'slug', 'fullName', 'level', 'icon', 'summary', 'aliases', 'popular', 'order', 'active'];
const COURSE_TEMPLATE_URL = '/api/admin/data-ops/courses/template.csv';

export default function ImportCourses() {
  const { request } = useAdminSession();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [linked, setLinked] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');

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

  async function action(path) {
    setBusy(path); setError(''); setConfirm('');
    try { setLinked(await request(`/data-ops/courses/${path}`, { method: 'POST', body: {} })); } catch (failure) { setError(failure.message); }
    setBusy('');
  }

  const relinked = linked?.relinked ?? (linked?.scanned != null ? linked : null);
  const shown = result ?? preview;
  return <>
    {error && <p className={styles.alert} role="alert"><Icon name="alert" />{error}</p>}
    <div className={styles.grid}>
      <Panel title="Import courses from a file" description="Dry run first; a row with an existing course's slug updates it."
        actions={<a className="adm-btn adm-btn--sm" href={COURSE_TEMPLATE_URL} download><Icon name="download" />CSV template</a>}>
        <label className={styles.drop}>
          <Icon name="upload" />
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => choose(event.target.files?.[0])} />
          {file ? <><strong>{file.name}</strong><span>{file.format.toUpperCase()} · choose another file to replace it</span></> : <><strong>Select a CSV or JSON file of courses</strong><span>Up to 2,000 courses.</span></>}
        </label>
        <details className={styles.details}>
          <summary>Expected columns</summary>
          <div>
            <div className={styles.columnList}>{COLUMNS.map((column) => <code key={column}>{column}</code>)}</div>
            <p><code>level</code> is UG, PG, Diploma or PhD. <code>aliases</code> holds other spellings separated by semicolons. A blank slug is made from the name.</p>
          </div>
        </details>
        {shown && <div style={{ marginTop: 12 }}><StatStrip label={result ? 'Import result' : 'Dry run result'} items={[
          { key: 'rows', label: 'Rows', value: shown.rows, icon: 'document' },
          { key: 'added', label: result ? 'Added' : 'Would add', value: shown.added, icon: 'plus', tone: 'good' },
          { key: 'updated', label: result ? 'Updated' : 'Would update', value: shown.updated, icon: 'edit', tone: 'info' },
          { key: 'failed', label: 'Rejected', value: shown.failed, icon: 'alert', tone: shown.failed ? 'bad' : undefined },
        ]} /></div>}
        {shown?.errors?.length > 0 && <ul className={styles.note}>{shown.errors.slice(0, 10).map((row) => <li key={row.row}>Row {row.row} {row.name}: {Object.entries(row.errors).map(([field, message]) => `${field} — ${message}`).join('; ')}</li>)}</ul>}
        <div className={styles.actionsRow} data-end>
          <button type="button" className="adm-btn" disabled={!file || Boolean(busy)} onClick={() => upload(true)}><Icon name="search" />{busy === 'check' ? 'Checking…' : 'Check file (dry run)'}</button>
          <button type="button" className="adm-btn adm-btn--primary" disabled={!preview || !(preview.added + preview.updated) || Boolean(busy)} onClick={() => upload(false)}>{busy === 'import' ? 'Importing…' : 'Import courses'}</button>
        </div>
      </Panel>

      <Panel title="Course catalogue" description="Courses are degrees (B.Tech, MBA …). Institutions' programmes link to a course by its name, full name or other spellings."
        actions={<Link className="adm-btn adm-btn--sm" href="/admin/courses">Edit courses</Link>}>
        <div className={styles.actionsRow} style={{ marginTop: 0 }}>
          <button type="button" className="adm-btn" disabled={Boolean(busy)} onClick={() => setConfirm('sync')}><Icon name="plus" />{busy === 'sync' ? 'Adding…' : 'Add all Indian degrees'}</button>
          <button type="button" className="adm-btn" disabled={Boolean(busy)} onClick={() => setConfirm('relink')}><Icon name="link" />{busy === 'relink' ? 'Relinking…' : 'Relink institutions'}</button>
        </div>
        {linked && <dl className={styles.kv} style={{ marginTop: 12 }}>
          {linked.catalogue && <><div><dt>Courses added</dt><dd>{formatCount(linked.catalogue.added)}</dd></div><div><dt>In catalogue</dt><dd>{formatCount(linked.catalogue.total)}</dd></div></>}
          {relinked && <><div><dt>Institutions relinked</dt><dd>{formatCount(relinked.updated)}</dd></div><div><dt>With courses</dt><dd>{formatCount(relinked.institutionsWithCourses)}</dd></div><div><dt>Programmes linked</dt><dd>{formatCount(relinked.linkedProgrammes)}</dd></div></>}
        </dl>}
      </Panel>
    </div>
    <ConfirmDialog open={Boolean(confirm)} title={confirm === 'sync' ? 'Add all Indian degrees?' : 'Relink every institution?'} confirmLabel={confirm === 'sync' ? 'Add degrees' : 'Relink'}
      busy={Boolean(busy)} onConfirm={() => action(confirm)} onCancel={() => setConfirm('')}>
      <p>{confirm === 'sync' ? 'Missing degrees from the built-in list are added to the course catalogue and every institution is relinked. Existing courses are not changed.' : 'Every institution’s programme names are matched to the course catalogue again. This rewrites the linked courses of all institutions.'}</p>
    </ConfirmDialog>
  </>;
}
