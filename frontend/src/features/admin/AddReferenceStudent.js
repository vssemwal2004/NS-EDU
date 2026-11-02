'use client';
// Add one reference student, or upload many from a CSV (checked in the browser, previewed, then sent).
// Reference students are follow-up records only: they never get a student login.
import { useId, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { useToaster } from './crm/toast';
import { formatCount } from './leads/lead-format';
import { Panel } from './ui/Page';
import { parseStudentCsv } from './student-csv';
import { studentRights } from './students-ui';
import styles from './ReferenceStudentsManager.module.css';

const EMPTY = { name: '', email: '', phone: '' };
const MAX_CSV_BYTES = 80_000;
const TEMPLATE = `data:text/csv;charset=utf-8,${encodeURIComponent('name,email,mobile\nAsha Rawat,asha@example.com,+919876543210\nRohit Negi,,9876501234\n')}`;

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter the student’s name.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.phone.trim() && !/^\+?[0-9]{10,15}$/.test(form.phone.trim())) errors.phone = 'Use 10 to 15 digits, optionally starting with +.';
  if (!form.email.trim() && !form.phone.trim()) errors.email = 'Enter an email or a mobile number.';
  return errors;
}

export default function AddReferenceStudent() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const rights = studentRights(admin);
  const fileId = useId();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [upload, setUpload] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState('');
  const [added, setAdded] = useState([]);

  async function create(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy('create');
    try {
      const { item } = await request('/reference-students', { method: 'POST', body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() } });
      setForm(EMPTY); setErrors({});
      setAdded((current) => [item, ...current].slice(0, 5));
      toast.success(`${item.name} added.`);
    } catch (failure) { setErrors({ ...(failure.fields ?? {}), form: failure.message }); } finally { setBusy(''); }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setUpload(null); setUploadError('');
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) { setUploadError('Choose a CSV smaller than 80 KB.'); return; }
    try { setUpload({ name: file.name, rows: parseStudentCsv(await file.text()) }); } catch (failure) { setUploadError(failure.message); }
  }

  async function importStudents() {
    setBusy('upload'); setUploadError('');
    try {
      const { count } = await request('/reference-students/import', { method: 'POST', body: { students: upload.rows } });
      setUpload(null);
      toast.success(`${formatCount(count)} students uploaded.`);
    } catch (failure) { setUploadError(failure.message); } finally { setBusy(''); }
  }

  if (admin && !rights.create) return <p className={`adm-panel ${styles.notice}`} role="alert"><Icon name="lock" />Your role cannot add students. Ask an owner for the “Add reference students” permission.</p>;
  const set = (name) => (event) => { setForm({ ...form, [name]: event.target.value }); if (errors[name] || errors.form) setErrors({ ...errors, [name]: undefined, form: undefined }); };

  return <div className={styles.screen}>
    <p className={styles.lead}>Reference students are follow-up records only; they never get a login. <Link href="/admin/reference-students">See all</Link></p>
    <div className={styles.columns}>
      <Panel title="Add one student">
        <form className={styles.form} onSubmit={create} noValidate>
          <label className="adm-label" htmlFor="ref-name"><span>Name<span className={styles.req} aria-hidden="true">*</span></span>
            <input id="ref-name" className="adm-input" maxLength={100} value={form.name} autoComplete="off" aria-invalid={errors.name ? true : undefined} onChange={set('name')} />
            {errors.name && <span className="adm-error">{errors.name}</span>}
          </label>
          <div className={styles.two}>
            <label className="adm-label" htmlFor="ref-email">Email
              <input id="ref-email" className="adm-input" type="email" maxLength={254} value={form.email} autoComplete="off" aria-invalid={errors.email ? true : undefined} onChange={set('email')} />
              {errors.email && <span className="adm-error">{errors.email}</span>}
            </label>
            <label className="adm-label" htmlFor="ref-phone">Mobile number
              <input id="ref-phone" className="adm-input" type="tel" inputMode="tel" maxLength={16} value={form.phone} autoComplete="off" placeholder="+91…" aria-invalid={errors.phone ? true : undefined} onChange={set('phone')} />
              {errors.phone && <span className="adm-error">{errors.phone}</span>}
            </label>
          </div>
          <p className="adm-hint">An email or a mobile number is required.{admin && !admin.isOwner && ' Students you add are assigned to you.'}</p>
          {errors.form && <p className={styles.formError} role="alert"><Icon name="alert" />{errors.form}</p>}
          <div className={styles.panelFooter}><button className="adm-btn adm-btn--primary" disabled={busy === 'create'} type="submit">{busy === 'create' ? 'Adding…' : 'Add student'}</button></div>
        </form>
        {added.length > 0 && <div className={styles.recent}>
          <p className="adm-label">Added just now</p>
          <ul>{added.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.email || item.phone}</span></li>)}</ul>
        </div>}
      </Panel>

      <Panel title="Upload a CSV" description="Columns: name, email, mobile. Each row needs a name and an email or mobile. Up to 200 rows." actions={<a className="adm-btn adm-btn--sm" href={TEMPLATE} download="reference-students-template.csv"><Icon name="download" />Template</a>}>
        <div className={styles.form}>
          <label className={styles.filePick} htmlFor={fileId}><Icon name="upload" /><span>{upload ? upload.name : 'Choose a CSV file'}</span><small>80 KB max</small>
            <input id={fileId} type="file" accept=".csv,text/csv" onChange={chooseFile} disabled={busy === 'upload'} />
          </label>
          {uploadError && <p className={styles.formError} role="alert"><Icon name="alert" />{uploadError}</p>}
          {upload && <>
            <div className={styles.previewTable}>
              <table><caption className="sr-only">First rows of {upload.name}</caption>
                <thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Mobile</th></tr></thead>
                <tbody>{upload.rows.slice(0, 8).map((row, index) => <tr key={index}><td className="crm-tabnum">{index + 1}</td><td>{row.name}</td><td>{row.email || '—'}</td><td>{row.phone || '—'}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="adm-hint">{formatCount(upload.rows.length)} {upload.rows.length === 1 ? 'student' : 'students'} ready{upload.rows.length > 8 ? `; showing the first 8` : ''}.</p>
            <div className={styles.panelFooter}>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setUpload(null)} disabled={busy === 'upload'}>Cancel</button>
              <button className="adm-btn adm-btn--primary" disabled={busy === 'upload'} type="button" onClick={importStudents}>{busy === 'upload' ? 'Uploading…' : `Upload ${formatCount(upload.rows.length)} students`}</button>
            </div>
          </>}
        </div>
      </Panel>
    </div>
  </div>;
}
