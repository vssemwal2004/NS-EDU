'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { StageChip } from '@/features/admin/crm/ui';
import styles from './UploadLeads.module.css';

const COLUMNS = ['fullName', 'phone', 'email', 'city', 'state', 'courseName', 'institutionName', 'message', 'source', 'priority'];
const ALIASES = { name: 'fullName', mobile: 'phone', mobileNumber: 'phone', course: 'courseName', institution: 'institutionName' };

// CSV records may contain quoted commas, quotes and newlines.
function parseCsv(input) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function leadsFromCsv(text) {
  const [header, ...lines] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) throw new Error('The CSV is empty.');
  const keys = header.map((value) => {
    const key = value.trim().replace(/[\s_-]+/g, '').toLowerCase();
    return COLUMNS.find((column) => column.toLowerCase() === key) || Object.entries(ALIASES).find(([alias]) => alias.toLowerCase() === key)?.[1] || '';
  });
  if (!keys.includes('fullName') || !keys.includes('phone')) throw new Error('The CSV needs fullName and phone columns.');
  if (!lines.length || lines.length > 100) throw new Error('Choose a CSV with 1 to 100 leads.');
  return lines.map((line) => Object.fromEntries(keys.flatMap((key, index) => key ? [[key, (line[index] ?? '').trim()]] : [])));
}

export default function UploadLeads() {
  const { admin, request } = useAdminSession();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const query = new URLSearchParams({ page: String(page), ...(employeeId && { employeeId }) });
      const data = await request(`/leads/uploads?${query}`);
      setItems(data.items); setTotal(data.total); setError('');
    } catch (problem) { setError(problem.message); }
  }, [admin, employeeId, page, request]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!admin?.isOwner) return;
    request('/access/staff').then((data) => setPeople(data.items.filter((person) => person.roleId !== 'owner'))).catch(() => {});
  }, [admin?.isOwner, request]);

  async function upload(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true); setError(''); setResults(null);
    try {
      if (file.size > 80_000) throw new Error('Choose a CSV smaller than 80 KB.');
      const rows = leadsFromCsv(await file.text());
      const outcome = await request('/crm/leads/import', { method: 'POST', body: { rows } });
      setResults(outcome); setPage(1); await load();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(total / 25));
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(`${COLUMNS.join(',')}\nRiya Sharma,9876543210,riya@example.com,Dehradun,Uttarakhand,B.Tech,,Wants hostel details,School fair,high\n`)}`;
  const pick = (chosen) => { setFile(chosen ?? null); setResults(null); setError(''); };
  return <div className={styles.page}>
    <section className={`adm-panel ${styles.card}`}>
      <header className={styles.head}>
        <div><h2>Upload leads</h2><p>A CSV with <code>fullName</code> and <code>phone</code>; up to 100 leads per file. Duplicates are reported and skipped.</p></div>
        <a className="adm-btn adm-btn--sm" href={template} download="leads-template.csv"><Icon name="download" />Template</a>
      </header>
      <form onSubmit={upload} className={styles.uploadForm}>
        <label className={styles.drop} data-drag={dragging || undefined} data-file={file ? '' : undefined}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}>
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose leads CSV" onChange={(event) => pick(event.target.files?.[0])} />
          <span className={styles.dropIcon}><Icon name={file ? 'document' : 'upload'} /></span>
          <span className={styles.dropText}>
            <strong>{file ? file.name : 'Drop a CSV here or click to choose'}</strong>
            <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · ready to upload` : `Optional columns: ${COLUMNS.slice(2).join(', ')}`}</small>
          </span>
        </label>
        <button className="adm-btn adm-btn--primary" type="submit" disabled={!file || busy}><Icon name="upload" />{busy ? 'Uploading…' : 'Upload CSV'}</button>
      </form>
      {results && <div className={styles.results} role="status">
        <span className="crm-tone" data-tone="good"><strong>{results.created}</strong> added</span>
        <span className="crm-tone" data-tone={results.failed ? 'bad' : 'neutral'}><strong>{results.failed}</strong> skipped</span>
        {results.failed > 0 && <ul>{results.results.filter((row) => !row.ok).map((row) => <li key={row.row}><b>Row {row.row}</b> {row.error}</li>)}</ul>}
      </div>}
      {error && <p className={styles.alert} role="alert"><Icon name="alert" />{error}</p>}
    </section>

    <section className={`adm-panel ${styles.card}`}>
      <header className={styles.head}>
        <div><h2>{admin?.isOwner ? 'Uploaded leads' : 'Uploaded by me'} <span className={styles.count}>{total.toLocaleString('en-IN')}</span></h2><p>Leads that came in through CSV uploads.</p></div>
        {admin?.isOwner && <label className={styles.who}><span className="sr-only">Uploaded by</span>
          <select className="adm-select" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }}>
            <option value="">My uploads</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
          </select></label>}
      </header>
      {items.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Lead</th><th>Mobile</th><th>Stage</th><th>Can work on it</th><th>Added</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td><span className={styles.lead}>{item.canWork ? <Link href={`/admin/leads/${item.id}`}>{item.applicant.fullName || item.ref}</Link> : <span>{item.applicant.fullName || item.ref}</span>}<small>{item.ref}</small></span></td>
          <td className="crm-tabnum">{item.applicant.phone}</td>
          <td><StageChip status={item.status} size="sm" /></td>
          <td>{item.canWork ? <span className={styles.yes}><Icon name="check" />Yes</span> : <span className={styles.no}>View only</span>}</td>
          <td className="crm-tabnum">{new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        </tr>)}</tbody>
      </table></div> : <div className={styles.empty}><span><Icon name="upload" /></span><strong>No uploaded leads yet</strong><p>Upload a CSV above; the leads you add appear here.</p></div>}
      {total > 25 && <footer className={styles.pager}>
        <span>Page {page} of {pages}</span>
        <span><button className="adm-btn adm-btn--sm" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="adm-btn adm-btn--sm" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span>
      </footer>}
    </section>
  </div>;}
