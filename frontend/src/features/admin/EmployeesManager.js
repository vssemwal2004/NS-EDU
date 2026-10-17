'use client';
import { useEffect, useState } from 'react';
import { useAdminSession } from './AdminSession';
import styles from './StaffForms.module.css';

const empty = { email: '', phone: '', password: '' };

export default function EmployeesManager() {
  const { admin, request } = useAdminSession();
  const [form, setForm] = useState(empty);
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ busy: false, error: '', success: '' });

  useEffect(() => {
    if (admin?.role !== 'admin') return;
    request('/employees').then(({ items }) => setItems(items)).catch((error) => setState((previous) => ({ ...previous, error: error.message })));
    // Load once when the authenticated administrator opens this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.role]);

  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, error: '', success: '' });
    try {
      const { item } = await request('/employees', { method: 'POST', body: form });
      setItems((previous) => [item, ...previous]);
      setForm(empty);
      setState({ busy: false, error: '', success: `Employee ${item.email} created. Share the temporary password securely.` });
    } catch (error) { setState({ busy: false, error: error.message, success: '' }); }
  }

  if (admin?.role !== 'admin') return <p role="alert">Administrator access required.</p>;
  return <div className={styles.layout}>
    <section className={styles.card}>
      <h2>Add employee</h2>
      <p>Employees sign in at /admin with the password you set. They must change it on their first sign-in.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="off" maxLength={254} required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Mobile number<input type="tel" inputMode="tel" autoComplete="off" pattern="\+?[0-9]{10,15}" title="Use 10 to 15 digits, optionally starting with +" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Temporary password<input type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <p className={styles.hint}>At least 8 characters, including uppercase, lowercase and a special character.</p>
        {state.error && <p className={styles.error} role="alert">{state.error}</p>}
        {state.success && <p className={styles.success} role="status">{state.success}</p>}
        <button className="button button--primary" type="submit" disabled={state.busy}>{state.busy ? 'Creating…' : 'Create employee'}</button>
      </form>
    </section>
    <section className={styles.card}>
      <h2>Employees</h2>
      {items.length ? <div className={styles.tableWrap}><table><thead><tr><th>Email</th><th>Mobile</th><th>Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.email}</td><td>{item.phone}</td><td>{item.mustChangePassword ? 'Password change required' : 'Active'}</td></tr>)}</tbody></table></div> : <p>No employees added yet.</p>}
    </section>
  </div>;
}
