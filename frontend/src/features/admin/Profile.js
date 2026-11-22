'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminSession } from './AdminSession';

export default function Profile() {
  const { admin, request, refreshAdmin } = useAdminSession();
  const [name, setName] = useState(admin?.name ?? '');
  const [phone, setPhone] = useState(admin?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await request('/access/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } });
      await refreshAdmin();
      setMessage('Profile saved.');
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  return <section className="adm-panel" style={{ padding: 24, maxWidth: 640 }}>
    <h2>My profile</h2>
    <p>{admin?.email}</p>
    <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
      <label>Full name<input className="adm-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
      <label>Mobile number<input className="adm-input" type="tel" value={phone} maxLength={16} onChange={(event) => setPhone(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        <Link href="/admin/change-password">Change password</Link>
      </div>
    </form>
  </section>;
}
