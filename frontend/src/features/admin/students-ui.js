'use client';
// Shared pieces of the Students screens: permissions, the assignable-staff list, the assign drawer and the
// student drawer (contact details, assignees and follow-up notes).
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from './AdminDrawer';
import { dateTimeOf, relativeTime } from './crm/format';
import { Avatar } from './crm/ui';
import styles from './ReferenceStudentsManager.module.css';

const holds = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
export const studentRights = (admin) => ({
  manage: holds(admin, 'students.manage'),
  create: holds(admin, 'students.create') || holds(admin, 'students.manage'),
});
export const studentName = (student) => student?.name || student?.email || student?.phone || 'Unnamed student';
export const contactOf = (student) => [student?.email, student?.phone].filter(Boolean).join(' · ');

/** Staff who can be given students (employees, not suspended). Only loaded for people who may assign. */
export function useAssignees(request, enabled) {
  const [state, setState] = useState({ items: [], error: '', loaded: false });
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    request('/reference-students/assignees', { signal: controller.signal })
      .then(({ items }) => setState({ items, error: '', loaded: true }))
      .catch((failure) => { if (failure.name !== 'AbortError') setState({ items: [], error: failure.message, loaded: true }); });
    return () => controller.abort();
  }, [enabled, request]);
  return state;
}

/** First assignee as a 20px avatar + name, then "+N". */
export function Assignees({ people = [] }) {
  if (!people.length) return <span className={styles.muted}>Unassigned</span>;
  const names = people.map((person) => person.name || person.email || 'Staff member');
  return <span className={styles.person} title={names.join(', ')}>
    <Avatar name={names[0]} email={people[0].email} size={20} />
    <span className={styles.clip}>{names[0]}</span>
    {names.length > 1 && <span className={styles.more}>+{names.length - 1}</span>}
  </span>;
}

/**
 * Pick staff for one student (`mode="replace"`: the ticked list becomes the assignment) or for many
 * (`mode="add"`: ticked staff are added; existing assignments stay).
 */
export function AssignDrawer({ open, title, subtitle, staff, initial = [], mode = 'replace', busy = false, error = '', onSave, onClose }) {
  const [chosen, setChosen] = useState(initial);
  const [filter, setFilter] = useState('');
  const [openKey, setOpenKey] = useState(open);
  if (open !== openKey) { setOpenKey(open); if (open) { setChosen(initial); setFilter(''); } }
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? staff.items.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(needle)) : staff.items;
  }, [filter, staff.items]);
  const toggle = (id, on) => setChosen((current) => (on ? [...current, id] : current.filter((item) => item !== id)));
  return <AdminDrawer open={open} onClose={onClose} title={title} subtitle={subtitle}>
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); onSave(chosen); }}>
      <p className="adm-hint">{mode === 'add' ? 'Ticked staff are added to every selected student. Existing assignments stay.' : 'Assigned staff see this student in their list and can add follow-up notes.'}</p>
      {staff.items.length > 8 && <label className={styles.search}><Icon name="search" /><span className="sr-only">Find staff</span>
        <input type="search" value={filter} placeholder="Find staff" onChange={(event) => setFilter(event.target.value)} /></label>}
      {staff.error && <p className="adm-error" role="alert">{staff.error}</p>}
      {!staff.loaded && <div className={styles.checkSkeleton} aria-hidden="true"><span /><span /><span /></div>}
      {staff.loaded && !staff.items.length && !staff.error && <p className={styles.muted}>No staff to assign yet. Add counsellors in Team &amp; access.</p>}
      <ul className={styles.checkList} aria-label="Staff">
        {shown.map((person) => <li key={person.id}><label>
          <input type="checkbox" checked={chosen.includes(person.id)} onChange={(event) => toggle(person.id, event.target.checked)} />
          <span><strong>{person.name || person.email}</strong>{person.name && <small>{person.email}</small>}</span>
        </label></li>)}
      </ul>
      {error && <p className={styles.formError} role="alert"><Icon name="alert" />{error}</p>}
      <div className={styles.drawerFooter}>
        <span className={styles.muted}>{chosen.length} selected</span>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || (mode === 'add' && !chosen.length)}>{busy ? 'Saving…' : mode === 'add' ? 'Assign' : 'Save assignment'}</button>
      </div>
    </form>
  </AdminDrawer>;
}

/**
 * The student's drawer: contact, assignees (and a Change button for managers) and follow-up notes.
 * `base` is the API path of the student kind ('/reference-students' or '/account-students').
 */
export function StudentDrawer({ student, base, request, toast, canAssign, onAssign, meta, onClose }) {
  const [notes, setNotes] = useState({ items: [], total: 0, page: 1, loading: true, error: '' });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState('');
  const id = student?.id;

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    request(`${base}/${id}/followups?limit=50`, { signal: controller.signal })
      .then(({ items, total }) => setNotes({ items, total, page: 1, loading: false, error: '' }))
      .catch((failure) => { if (failure.name !== 'AbortError') setNotes({ items: [], total: 0, page: 1, loading: false, error: failure.message }); });
    return () => controller.abort();
  }, [base, id, request]);

  async function older() {
    setBusy('more');
    try {
      const { items, total } = await request(`${base}/${id}/followups?limit=50&page=${notes.page + 1}`);
      setNotes((current) => ({ ...current, items: [...current.items, ...items.filter((item) => !current.items.some((existing) => existing.id === item.id))], total, page: current.page + 1 }));
    } catch (failure) { toast.error(failure.message); } finally { setBusy(''); }
  }
  async function add(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy('add');
    try {
      const { item } = await request(`${base}/${id}/followups`, { method: 'POST', body: { comment } });
      setNotes((current) => ({ ...current, items: [item, ...current.items], total: current.total + 1 }));
      setComment('');
      toast.success('Follow-up note saved.');
    } catch (failure) { toast.error(failure.message); } finally { setBusy(''); }
  }

  return <AdminDrawer open={Boolean(student)} onClose={onClose} title={studentName(student)} subtitle={meta}>
    {student && <div className={styles.drawerStack}>
      <dl className={styles.facts}>
        <div><dt>Email</dt><dd>{student.email || <span className={styles.muted}>—</span>}</dd></div>
        <div><dt>Mobile</dt><dd className="crm-tabnum">{student.phone || <span className={styles.muted}>—</span>}</dd></div>
        <div><dt>Assigned to</dt><dd className={styles.factRow}><Assignees people={student.assignees} />
          {canAssign && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onAssign}><Icon name="userPlus" />Change</button>}</dd></div>
      </dl>
      <section className={styles.notes} aria-labelledby="student-notes">
        <h3 id="student-notes">Follow-up notes <span className={`${styles.muted} crm-tabnum`}>{notes.loading ? '' : notes.total}</span></h3>
        <form className={styles.noteForm} onSubmit={add}>
          <label className="sr-only" htmlFor="student-note">Add a note</label>
          <textarea id="student-note" className="adm-textarea" rows={3} maxLength={2000} value={comment} placeholder="What was discussed and the next step" onChange={(event) => setComment(event.target.value)} />
          <div className={styles.noteActions}><span className="adm-hint">{comment.length}/2000</span>
            <button type="submit" className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy === 'add' || !comment.trim()}>{busy === 'add' ? 'Saving…' : 'Save note'}</button></div>
        </form>
        {notes.error && <p className="adm-error" role="alert">{notes.error}</p>}
        {notes.loading ? <div className={styles.checkSkeleton} aria-hidden="true"><span /><span /></div>
          : !notes.items.length && !notes.error ? <p className={styles.muted}>No notes yet.</p>
            : <ol className={styles.noteList}>{notes.items.map((note) => <li key={note.id}>
              <p>{note.comment}</p><small title={dateTimeOf(note.createdAt)}>{note.authorEmail} · {relativeTime(note.createdAt)}</small>
            </li>)}</ol>}
        {notes.items.length < notes.total && <button type="button" className="adm-btn adm-btn--sm" disabled={busy === 'more'} onClick={older}>{busy === 'more' ? 'Loading…' : 'Show older notes'}</button>}
      </section>
    </div>}
  </AdminDrawer>;
}
