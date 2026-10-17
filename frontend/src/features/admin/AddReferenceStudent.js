'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAdminSession } from './AdminSession';
import { parseStudentCsv } from './student-csv';
import styles from './ReferenceStudentsManager.module.css';

const empty = { name: '', email: '', phone: '' };

export default function AddReferenceStudent() {
  const { request } = useAdminSession();
  const [form, setForm] = useState(empty);
  const [upload, setUpload] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ text: '', error: false });

  async function create(event) {
    event.preventDefault();
    setBusy('create'); setMessage({ text: '', error: false });
    try {
      await request('/reference-students', { method: 'POST', body: form });
      setForm(empty); setMessage({ text: 'Student added. You can add another or open View students to follow up.', error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(''); }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    setUpload(null);
    if (!file) return;
    if (file.size > 80_000) { setMessage({ text: 'Choose a CSV smaller than 80 KB.', error: true }); event.target.value = ''; return; }
    try {
      const rows = parseStudentCsv(await file.text());
      setUpload(rows); setMessage({ text: `${rows.length} students ready to upload.`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    event.target.value = '';
  }

  async function importStudents() {
    if (!upload) return;
    setBusy('upload'); setMessage({ text: '', error: false });
    try {
      const { count } = await request('/reference-students/import', { method: 'POST', body: { students: upload } });
      setUpload(null); setMessage({ text: `${count} students uploaded. Open View students to see them.`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(''); }
  }

  return <div className={styles.layout}>
    <div className={styles.heading}><div><h2>Add student</h2><p>Add a reference student or upload a CSV. These records do not create student login accounts.</p></div><Link className="button button--ghost" href="/admin/reference-students">View students</Link></div>
    {message.text && <p className={message.error ? styles.error : styles.success} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    <div className={styles.columns}>
      <section className={styles.card}>
        <h3>Add one student</h3>
        <form className={styles.form} onSubmit={create}>
          <label>Name<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email<input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Mobile number<input type="tel" pattern="\+?[0-9]{10,15}" title="Use 10 to 15 digits, optionally starting with +" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <p className={styles.hint}>Email or mobile number is required.</p>
          <button className="button button--primary" disabled={Boolean(busy)} type="submit">{busy === 'create' ? 'Adding…' : 'Add student'}</button>
        </form>
      </section>
      <section className={styles.card}>
        <h3>Upload students</h3>
        <p className={styles.hint}>CSV columns: name, email, mobile. Include email or mobile for each student. Up to 200 rows.</p>
        <label className={styles.fileLabel}>Choose CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile} /></label>
        {upload && <button className="button button--primary" disabled={Boolean(busy)} type="button" onClick={importStudents}>{busy === 'upload' ? 'Uploading…' : `Upload ${upload.length} students`}</button>}
      </section>
    </div>
  </div>;
}
