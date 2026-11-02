'use client';
// Opens a catalogue record for editing: loads the full record by id (lists only carry the table's columns),
// shows a skeleton meanwhile, and asks before discarding unsaved changes. Universities get a wide sheet with
// sections and a sticky save footer; everything else uses the standard right-hand drawer.
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import ConfirmDialog from '../crm/ConfirmDialog';
import ResourceForm from '../ResourceForm';
import { STATES } from '../data/SourceForms';
import { ErrorState, FormSkeleton } from './CatalogueParts';
import styles from './Catalogue.module.css';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (value) => (typeof value === 'number' ? `₹${inr.format(value)}` : '—');

function ProgrammeReadout(item) {
  const rows = item?.programmesOffered ?? [];
  const withFees = rows.filter((row) => [row.annualFeeInr, row.semesterFeeInr, row.totalFeeInr].some((value) => typeof value === 'number'));
  const history = item?.placementHistory ?? [];
  return <div className={styles.readout} key="programmes-readout">
    <div className={styles.readoutHead}>
      <span className={styles.fieldLabel}>Programme rows<i className={styles.hint} title="Read-only here: the crawler or an import updates these rows." aria-hidden="true">i</i></span>
      {rows.length > 0 && <p className="crm-tabnum">{rows.length.toLocaleString('en-IN')} rows · {withFees.length.toLocaleString('en-IN')} with fees{history.length ? ` · ${history.length} placement season${history.length === 1 ? '' : 's'}` : ''}</p>}
    </div>
    {rows.length ? <>
      <div className={styles.miniScroll}><table className={styles.miniTable}>
        <thead><tr><th scope="col">Programme</th><th scope="col">Level</th><th scope="col" className={styles.num}>Annual fee</th><th scope="col" className={styles.num}>Total fee</th><th scope="col">Session</th></tr></thead>
        <tbody>{(withFees.length ? withFees : rows).slice(0, 8).map((row, index) => <tr key={`${row.name}-${index}`}>
          <td><span className={styles.truncate} title={row.name}>{row.name}</span></td><td>{row.level || '—'}</td>
          <td className={styles.num}>{money(row.annualFeeInr)}</td><td className={styles.num}>{money(row.totalFeeInr)}</td><td>{row.feeYear || '—'}</td>
        </tr>)}</tbody>
      </table></div>
      {rows.length > 8 && <p>First 8 of {rows.length.toLocaleString('en-IN')}{withFees.length ? ', rows with fees first' : ''}</p>}
    </> : <p className={styles.readoutValue}><span className={styles.muted}>None yet</span></p>}
  </div>;
}

function MediaReadout(item) {
  const gallery = item?.gallery ?? [];
  return <div className={styles.readout} key="media-readout">
    <span className={styles.fieldLabel}>Campus photos<i className={styles.hint} title="From the institution’s own website, each with its credit and source page. Managed by the crawler." aria-hidden="true">i</i></span>
    <p className={styles.readoutValue}>{gallery.length ? `${gallery.length} photo${gallery.length === 1 ? '' : 's'}` : <span className={styles.muted}>None yet</span>}</p>
  </div>;
}

function LockReadout(item) {
  const locked = item?.lockedFields ?? [];
  return <div className={styles.readout} key="lock-readout">
    <span className={styles.fieldLabel}>Protected from imports<i className={styles.hint} title="Fields edited by hand. Imports and crawls never overwrite them; any field you change here joins the list." aria-hidden="true">i</i></span>
    <p className={styles.readoutValue}>{locked.length ? locked.join(', ') : <span className={styles.muted}>None yet</span>}</p>
  </div>;
}

export const UNIVERSITY_SECTIONS = [
  { id: 'basics', label: 'Basics', icon: 'building', fields: ['name', 'shortName', 'slug', 'aliases', 'type', 'category', 'ownership', 'establishedYear', 'about', 'aboutSource', 'facilities', 'activities'] },
  { id: 'location', label: 'Location', icon: 'location', fields: ['address', 'city', 'district', 'state', 'pincode'] },
  { id: 'contact', label: 'Contact', icon: 'phone', description: 'Official, institutional contacts only.', fields: ['website', 'admissionUrl', 'email', 'phone'] },
  { id: 'approvals', label: 'Approvals', icon: 'shield', description: 'Affiliation, accreditation and ranking.', fields: ['affiliatedTo', 'approvals', 'naacGrade', 'nirfRank', 'nirfYear', 'nirfCategory'] },
  { id: 'programmes', label: 'Programmes & fees', icon: 'layers', fields: ['streams', 'courseSlugs', 'coursesOffered', 'entranceExams', 'admissionNote'], extra: ProgrammeReadout },
  { id: 'media', label: 'Media', icon: 'archive', fields: ['logoUrl', 'coverUrl'], extra: MediaReadout },
  { id: 'visibility', label: 'Visibility', icon: 'eye', description: 'Who sees this record and where it ranks.', fields: ['active', 'verification', 'isIllustrative', 'popularity', 'order', 'demoRating', 'art'], extra: LockReadout },
];
// Short lists sit beside the slug; the source link takes the whole row under "About".
const UNIVERSITY_OVERRIDES = { state: { type: 'select', options: ['', ...STATES] }, aliases: { wide: false }, aboutSource: { wide: true } };

/**
 * editor: { mode: 'create' | 'edit' | 'copy', id?, title?, seed? } — `seed` pre-fills a create (e.g. a copy).
 * onSaved(item, mode) runs after a successful save; the editor closes itself through onClose.
 */
export default function RecordEditor({ resource, meta, editor, refOptions, onClose, onSaved }) {
  const { request } = useAdminSession();
  const [record, setRecord] = useState({ id: null, item: null, error: '' });
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = useRef(false);
  const sheet = useRef(null);
  const open = Boolean(editor && meta);
  const editing = editor?.mode === 'edit';
  const wide = resource === 'institutions';

  const editId = editing ? editor.id : null;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!editId) return undefined;
    const controller = new AbortController();
    request(`/${resource}/${editId}`, { signal: controller.signal })
      .then((data) => setRecord({ id: editId, item: data.item, error: '' }))
      .catch((failure) => { if (failure.name !== 'AbortError') setRecord({ id: editId, item: null, error: failure.message }); });
    return () => controller.abort();
  }, [editId, request, resource, attempt]);
  const retry = () => { setRecord({ id: null, item: null, error: '' }); setAttempt((value) => value + 1); };
  useEffect(() => { dirty.current = false; }, [editor]);

  // The university sheet is a native modal <dialog>, so focus is trapped and Esc reaches onCancel.
  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    if (open && wide && !node.open) node.showModal();
    if ((!open || !wide) && node.open) node.close();
  }, [open, wide]);

  const requestClose = () => { if (dirty.current) setConfirmClose(true); else onClose(); };
  const onDirtyChange = useCallback((value) => { dirty.current = value; }, []);

  async function save(payload) {
    const result = editing
      ? await request(`/${resource}/${editor.id}`, { method: 'PATCH', body: payload })
      : await request(`/${resource}`, { method: 'POST', body: payload });
    dirty.current = false;
    onSaved(result.item, editor.mode);
  }

  const ready = !editing || (record.id === editor?.id && record.item);
  const item = editing ? record.item : editor?.seed ?? null;
  const formKey = `${editor?.mode}-${editor?.id ?? editor?.key ?? 'new'}`;
  const singular = meta?.singular ?? 'record';
  const title = editing ? `Edit ${singular}` : editor?.mode === 'copy' ? `Copy of ${editor.title}` : `New ${singular}`;
  const subtitle = editing ? (record.item?.name ?? record.item?.label ?? editor?.title ?? '') : editor?.mode === 'copy' ? 'Change what differs, then save.' : `Adds a ${singular} to the Gyaan Vidhya catalogue.`;
  const body = !open ? null
    : editing && record.id === editId && record.error ? <ErrorState message={record.error} onRetry={retry} />
      : !ready ? <FormSkeleton />
        : <ResourceForm key={formKey} meta={meta} mode={editing ? 'edit' : 'create'} item={item} refOptions={refOptions} onSubmit={save} onCancel={requestClose} onDirtyChange={onDirtyChange}
          layout={wide ? 'sections' : 'drawer'} sections={wide ? UNIVERSITY_SECTIONS : undefined} fieldOverrides={wide ? UNIVERSITY_OVERRIDES : undefined}
          footerNote={wide ? (editing ? 'Fields you change are protected from later imports.' : 'New universities are marked as added by an administrator.') : undefined} />;

  return <>
    {wide ? <dialog ref={sheet} className={styles.sheet} aria-labelledby="record-editor-title"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      {open && <div className={styles.sheetPanel}>
        <header className={styles.sheetHead}>
          <div className={styles.sheetHeadText}><h2 id="record-editor-title">{editing && record.item ? record.item.name : title}</h2><p>{editing ? 'Edit university' : subtitle}</p></div>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon" onClick={requestClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        {editing && !ready ? <div className={styles.sheetScroll}>{body}</div> : body}
      </div>}
    </dialog>
      : <AdminDrawer open={open} onClose={requestClose} title={title} subtitle={subtitle}>{body}</AdminDrawer>}
    <ConfirmDialog open={confirmClose} tone="danger" icon="alert" title="Discard unsaved changes?" confirmLabel="Discard changes" cancelLabel="Keep editing"
      onConfirm={() => { setConfirmClose(false); dirty.current = false; onClose(); }} onCancel={() => setConfirmClose(false)}>
      <p>The changes you made to this {singular} have not been saved.</p>
    </ConfirmDialog>
  </>;
}
