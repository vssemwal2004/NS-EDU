'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminSession } from '@/features/admin/AdminSession';

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

  return <div style={{ display: 'grid', gap: 20 }}>
    <nav aria-label="Lead views" style={{ display: 'flex', gap: 16 }}>
      <Link href="/admin/leads">Assigned leads</Link><strong>Uploaded leads</strong>
    </nav>
    <section className="adm-panel" style={{ padding: 20 }}>
      <h2>Upload leads</h2>
      <p>Use a CSV with fullName and phone columns. Optional columns: {COLUMNS.slice(2).join(', ')}. Up to 100 leads per upload. Duplicates are reported and skipped.</p>
      <form onSubmit={upload} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept=".csv,text/csv" aria-label="Choose leads CSV" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="adm-btn adm-btn--primary" type="submit" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload CSV'}</button>
      </form>
      {results && <div role="status"><p>{results.created} added · {results.failed} skipped.</p>
        {results.failed > 0 && <ul>{results.results.filter((row) => !row.ok).map((row) => <li key={row.row}>Row {row.row}: {row.error}</li>)}</ul>}
      </div>}
    </section>
    <section className="adm-panel" style={{ padding: 20 }}>
      <h2>{admin?.isOwner ? 'Employee uploads' : 'Uploaded by me'} <small>({total})</small></h2>
      {admin?.isOwner && <label>Employee <select className="adm-select" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }}>
        <option value="">My uploads</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
      </select></label>}
      {error && <p role="alert">{error}</p>}
      {items.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr><th>Lead</th><th>Mobile</th><th>Stage</th><th>Assigned to me</th><th>Added</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td>{item.canWork ? <Link href={`/admin/leads/${item.id}`}>{item.applicant.fullName || item.ref}</Link> : item.applicant.fullName || item.ref}<small> · {item.ref}</small></td>
          <td>{item.applicant.phone}</td><td>{item.status}</td><td>{item.canWork ? 'Yes' : 'No · view only'}</td><td>{new Date(item.createdAt).toLocaleDateString('en-IN')}</td>
        </tr>)}</tbody>
      </table></div> : <p>No uploaded leads found.</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="adm-btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="adm-btn" type="button" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  </div>;
}
