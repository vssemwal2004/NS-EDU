'use client';
// Roles: a role list on the left, the editor on the right. The editor reads top to bottom: details →
// lead and analytics visibility → permission groups (collapsible). A save bar appears at the bottom of the
// editor only while there are unsaved changes; leaving with changes asks first.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { can, ROLE_TONES } from '@/features/admin/crm/meta';
import RowMenu from '@/features/admin/crm/RowMenu';
import {
  LADDERS, LADDER_KEYS, RISK, adminKeys, catalogueIndex, effectiveKeys, groupPermissions, ladderLevel, normaliseKeys, reachWords, sameKeys, withLadder,
} from './access-model';
import { ConfirmDialog, RiskMark, Segmented } from './AccessParts';
import access from './Access.module.css';
import styles from './Roles.module.css';

const tagOf = (role) => (role.locked ? 'Locked' : role.system ? 'Built-in' : 'Custom');
const titleCase = (text) => text[0].toUpperCase() + text.slice(1);
const OWNER_WORDS = 'The Owner role always holds every permission, including ones added later, so the company can never be locked out. It cannot be edited or deleted.';

function snapshot(role, catalogue) {
  const known = catalogueIndex(catalogue);
  const keys = role.locked ? effectiveKeys(['*'], catalogue) : normaliseKeys((role.permissions ?? []).filter((key) => known.has(key)));
  return { name: role.name, color: role.color, description: role.description ?? '', keys };
}
const blankDraft = () => ({ name: '', color: 'slate', description: '', keys: new Set() });

/** One line of the sheet: a muted label on the left, the setting on the right. */
function Row({ label, htmlFor, error, top = false, children }) {
  return <div className={styles.row} data-top={top || undefined}>
    {htmlFor ? <label className={styles.rowLabel} htmlFor={htmlFor}>{label}</label> : <span className={styles.rowLabel}>{label}</span>}
    <div className={styles.rowValue}>{children}{error && <small className="adm-error" role="alert">{error}</small>}</div>
  </div>;
}

function Visibility({ ladder, keys, held, disabled, onChange }) {
  const level = ladderLevel(keys, ladder.id);
  // A rung above your own level cannot be granted (the server refuses it too).
  const options = ladder.steps.map((step) => {
    const blocked = step.value > 0 && step.value > level && !held.has(ladder.keys[step.value - 1]);
    return { value: step.value, label: step.label, disabled: blocked, title: blocked ? 'You do not hold this level, so you cannot grant it.' : step.words };
  });
  return <Row label={ladder.id === 'leads' ? 'Leads' : 'Analytics'}>
    <Segmented label={ladder.title} value={level} options={options} disabled={disabled} onChange={(value) => onChange(ladder.id, value)} />
  </Row>;
}

function ToggleRow({ permission, on, held, disabled, onToggle }) {
  const cannotGrant = !on && !held;
  const off = disabled || cannotGrant;
  const tip = cannotGrant && !disabled ? `${permission.hint} You do not hold this permission, so you cannot grant it.` : permission.hint;
  return <label className={styles.toggle} data-disabled={off || undefined} title={tip}>
    <span className={styles.toggleName}>{permission.label}<RiskMark risk={permission.risk} /></span>
    <input type="checkbox" role="switch" className={styles.switch} checked={on} disabled={off} onChange={() => onToggle(permission.key)} />
  </label>;
}

function Group({ group, keys, held, disabled, open, onOpen, onToggle }) {
  const rows = group.permissions.filter((permission) => !LADDER_KEYS.has(permission.key));
  if (!rows.length) return null;
  const on = rows.filter((permission) => keys.has(permission.key)).length;
  return <section className={styles.group}>
    <h5 className={styles.groupHead}>
      <button type="button" aria-expanded={open} aria-controls={`group-${group.id}`} onClick={() => onOpen(group.id, !open)}>
        <Icon name="chevron" className={styles.chev} />
        <span>{group.label}</span>
        <small className="crm-tabnum" data-none={on === 0 || undefined}>{on} of {rows.length}</small>
      </button>
    </h5>
    {open && <div id={`group-${group.id}`} className={styles.toggles}>
      {rows.map((permission) => <ToggleRow key={permission.key} permission={permission} on={keys.has(permission.key)} held={held.has(permission.key)} disabled={disabled} onToggle={onToggle} />)}
    </div>}
  </section>;
}

export default function RolesTab({ admin, request, data, reload, notify, onDirty }) {
  const { catalogue, roles } = data;
  const canEditRoles = can(admin, 'roles.manage');
  const held = useMemo(() => adminKeys(admin, catalogue), [admin, catalogue]);
  const groups = useMemo(() => groupPermissions(catalogue), [catalogue]);
  const index = useMemo(() => catalogueIndex(catalogue), [catalogue]);

  const first = roles.find((role) => !role.locked) ?? roles[0];
  const [selected, setSelected] = useState(first?.slug ?? 'new');
  const [baseline, setBaseline] = useState(() => (first ? snapshot(first, catalogue) : blankDraft()));
  const [draft, setDraft] = useState(baseline);
  const [openGroups, setOpenGroups] = useState(() => new Set(['leads']));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [pending, setPending] = useState(null);
  const [highRisk, setHighRisk] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const isNew = selected === 'new';
  const role = roles.find((candidate) => candidate.slug === selected);
  const locked = Boolean(role?.locked);
  const readOnly = !canEditRoles || locked;
  const dirty = !readOnly && (draft.name !== baseline.name || draft.color !== baseline.color || draft.description !== baseline.description || !sameKeys(draft.keys, baseline.keys));
  const showBar = !readOnly && (isNew || dirty);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const open = useCallback((slug, seed) => { setSelected(slug); setBaseline(seed); setDraft(seed); setError(''); setFields({}); }, []);
  const guarded = (run) => { if (dirty) setPending({ run }); else run(); };
  const selectRole = (candidate) => guarded(() => open(candidate.slug, snapshot(candidate, catalogue)));
  const startNew = () => guarded(() => open('new', blankDraft()));
  const duplicate = (source) => guarded(() => {
    const seed = snapshot(source, catalogue);
    // The Owner role's "everything" is not a permission list anyone can grant; a copy starts from what you hold.
    open('new', { ...seed, name: `${source.name} copy`.slice(0, 40), keys: source.locked ? normaliseKeys([...held]) : seed.keys });
    setBaseline(blankDraft());
  });
  const rename = (candidate) => guarded(() => {
    open(candidate.slug, snapshot(candidate, catalogue));
    window.setTimeout(() => { const input = document.getElementById('role-name'); input?.focus(); input?.select(); }, 50);
  });
  const askDelete = (candidate) => guarded(() => { setDeleteError(''); setDeleting(candidate); });

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const toggle = (key) => setDraft((current) => { const keys = new Set(current.keys); if (keys.has(key)) keys.delete(key); else keys.add(key); return { ...current, keys }; });
  const setLadder = (ladder, level) => setDraft((current) => ({ ...current, keys: withLadder(current.keys, ladder, level) }));
  const setGroupOpen = (id, value) => setOpenGroups((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });
  const allOpen = groups.every((group) => openGroups.has(group.id));

  const effective = useMemo(() => effectiveKeys([...draft.keys], catalogue), [draft.keys, catalogue]);
  const grants = useMemo(() => {
    const before = effectiveKeys([...baseline.keys], catalogue);
    return [...effective].filter((key) => !before.has(key)).map((key) => index.get(key)).filter((permission) => permission?.risk === 'high');
  }, [effective, baseline.keys, catalogue, index]);

  async function save(confirmed = false) {
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 40) { setFields({ name: 'Use 2 to 40 characters.' }); setError('Give the role a name of 2 to 40 characters.'); document.getElementById('role-name')?.focus(); return; }
    if (!confirmed && grants.length) { setHighRisk(grants); return; }
    setHighRisk(null); setBusy(true); setError(''); setFields({});
    try {
      const body = { name, color: draft.color, description: draft.description.trim(), permissions: [...draft.keys] };
      const { item } = await request(isNew ? '/access/roles' : `/access/roles/${selected}`, { method: isNew ? 'POST' : 'PATCH', body });
      const saved = { ...draft, name: item.name, description: item.description };
      await reload();
      setSelected(item.slug); setBaseline(saved); setDraft(saved);
      notify(isNew ? `Role “${item.name}” created.` : `Role “${item.name}” saved.`);
    } catch (problem) { setError(problem.message); setFields(problem.fields ?? {}); } finally { setBusy(false); }
  }
  const discard = () => { if (isNew) open(first.slug, snapshot(first, catalogue)); else { setDraft(baseline); setError(''); setFields({}); } };

  async function remove() {
    const target = deleting;
    setBusy(true); setDeleteError('');
    try {
      await request(`/access/roles/${target.slug}`, { method: 'DELETE' });
      setDeleting(null);
      if (target.slug === selected) { const next = roles.find((candidate) => !candidate.locked && candidate.slug !== target.slug) ?? roles[0]; open(next.slug, snapshot(next, catalogue)); }
      await reload();
      notify(`Role “${target.name}” deleted.`);
    } catch (problem) { setDeleteError(problem.message); } finally { setBusy(false); }
  }

  const blockFor = (candidate) => (candidate.system ? 'Built-in roles cannot be deleted. Edit their permissions instead.'
    : candidate.members > 0 ? `${candidate.members} ${candidate.members === 1 ? 'person holds' : 'people hold'} this role. Move them to another role first.` : '');
  const menuFor = (candidate) => [
    { key: 'duplicate', label: 'Duplicate', icon: 'copy', hidden: !canEditRoles, onSelect: () => duplicate(candidate) },
    { key: 'rename', label: 'Rename', icon: 'edit', hidden: !canEditRoles || candidate.locked, onSelect: () => rename(candidate) },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !canEditRoles || candidate.locked, disabled: Boolean(blockFor(candidate)), reason: blockFor(candidate), onSelect: () => askDelete(candidate) },
  ];

  const listItem = (candidate) => <li key={candidate.slug} className={styles.roleRow} aria-current={candidate.slug === selected ? 'true' : undefined}>
    <button type="button" className={styles.roleItem} onClick={() => selectRole(candidate)} aria-current={candidate.slug === selected ? 'true' : undefined}>
      <i className={`crm-tone ${styles.dot}`} data-tone={ROLE_TONES[candidate.color] ?? 'neutral'} aria-hidden="true" />
      <span className={styles.roleName}><strong>{candidate.name}</strong><small>{tagOf(candidate)} · {candidate.members} {candidate.members === 1 ? 'member' : 'members'}</small></span>
    </button>
    <RowMenu label={`Actions for ${candidate.name}`} items={menuFor(candidate)} />
  </li>;

  return <div className={styles.layout}>
    <aside className={`adm-panel ${styles.list}`} aria-label="Roles">
      <div className={styles.listHead}>
        <h3>Roles <small className="crm-tabnum">{roles.length}</small></h3>
        {canEditRoles && <button type="button" className="adm-btn adm-btn--sm" onClick={startNew}><Icon name="plus" />New role</button>}
      </div>
      <ul>
        {roles.map(listItem)}
        {isNew && <li className={styles.roleRow} aria-current="true"><span className={styles.roleItem}><i className={`crm-tone ${styles.dot}`} data-tone={ROLE_TONES[draft.color] ?? 'neutral'} /><span className={styles.roleName}><strong>{draft.name || 'New role'}</strong><small>Not saved yet</small></span></span></li>}
      </ul>
    </aside>

    <section className={`adm-panel ${styles.editor}`} aria-label={isNew ? 'New role' : `Role ${role?.name ?? ''}`}>
      <header className={styles.editorHead}>
        <div className={styles.editorTitle}>
          <h3>{draft.name.trim() || (isNew ? 'New role' : 'Untitled role')}</h3>
          <small>{isNew ? 'Not saved yet' : role ? `${tagOf(role)} · ${role.members} ${role.members === 1 ? 'member' : 'members'} · ${reachWords(effective)}` : reachWords(effective)}</small>
        </div>
        {!isNew && role && <RowMenu label={`More actions for ${role.name}`} items={menuFor(role)} />}
      </header>

      <div className={styles.editorBody}>
        {locked && <p className={access.note}><Icon name="lock" />{OWNER_WORDS}</p>}
        {!canEditRoles && !locked && <p className={access.note}><Icon name="eye" />View only. People with “Edit roles and permissions” can change roles.</p>}
        {error && <p className={access.formError} role="alert"><Icon name="alert" />{error}</p>}

        <section className={styles.section} aria-labelledby="role-details">
          <h4 id="role-details" className={access.sectionLabel}>Details</h4>
          <Row label="Name" htmlFor="role-name" error={fields.name}>
            <input id="role-name" className={`adm-input ${styles.nameInput}`} value={draft.name} maxLength={40} disabled={readOnly} aria-invalid={Boolean(fields.name)} onChange={(event) => set({ name: event.target.value })} />
          </Row>
          <Row label="Colour" error={fields.color}>
            <div className={styles.swatches} role="radiogroup" aria-label="Role colour">
              {(catalogue.colors ?? []).map((color) => <button key={color} type="button" role="radio" aria-checked={draft.color === color} aria-label={titleCase(color)} title={titleCase(color)}
                className={`crm-tone ${styles.swatch}`} data-tone={ROLE_TONES[color] ?? 'neutral'} disabled={readOnly} onClick={() => set({ color })} />)}
            </div>
          </Row>
          <Row label="Description" htmlFor="role-description" error={fields.description} top>
            <textarea id="role-description" className="adm-textarea" rows={2} maxLength={240} placeholder="Who this role is for" value={draft.description} disabled={readOnly} onChange={(event) => set({ description: event.target.value })} />
            {!readOnly && <small className={styles.counter}>{draft.description.length}/240</small>}
          </Row>
        </section>

        <section className={styles.section} aria-labelledby="role-visibility">
          <h4 id="role-visibility" className={access.sectionLabel}>Visibility</h4>
          <Visibility ladder={LADDERS.leads} keys={draft.keys} held={held} disabled={readOnly} onChange={setLadder} />
          <Visibility ladder={LADDERS.analytics} keys={draft.keys} held={held} disabled={readOnly} onChange={setLadder} />
        </section>

        <section className={styles.section} aria-labelledby="role-permissions">
          <div className={styles.permHead}>
            <h4 id="role-permissions" className={access.sectionLabel}>Permissions</h4>
            <small className="crm-tabnum">{effective.size} of {catalogue.permissions.length} on</small>
            <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((group) => group.id)))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
          </div>
          {fields.permissions && <p className="adm-error" role="alert">{fields.permissions}</p>}
          <div className={styles.groups}>
            {groups.map((group) => <Group key={group.id} group={group} keys={draft.keys} held={held} disabled={readOnly} open={openGroups.has(group.id)} onOpen={setGroupOpen} onToggle={toggle} />)}
          </div>
          <p className={styles.legend}><RiskMark risk="medium" /> changes shared data · <RiskMark risk="high" /> can delete data, export personal data or change access · hover a permission for details</p>
        </section>
      </div>

      {showBar && <footer className={styles.saveBar} aria-live="polite">
        <span><Icon name="alert" />{isNew ? 'New role, not saved yet' : 'Unsaved changes'}</span>
        <button type="button" className="adm-btn" disabled={busy} onClick={discard}>{isNew ? 'Cancel' : 'Discard'}</button>
        <button type="button" className="adm-btn adm-btn--primary" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}</button>
      </footer>}
    </section>

    <ConfirmDialog open={pending !== null} tone="danger" title="Discard unsaved changes?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setPending(null)} onConfirm={() => { const { run } = pending; setPending(null); run(); }}>
      <p>You have unsaved changes to this role. If you continue they will be lost.</p>
    </ConfirmDialog>
    <ConfirmDialog open={highRisk !== null} tone="danger" title="Grant high-risk permissions?" confirmLabel="Yes, grant them" busy={busy} onCancel={() => setHighRisk(null)} onConfirm={() => save(true)}>
      <p>Everyone who holds this role will be able to:</p>
      <ul className={styles.riskList}>{(highRisk ?? []).map((permission) => <li key={permission.key}><strong>{permission.label}</strong> <span className="adm-hint">{permission.hint}</span></li>)}</ul>
      <p className="adm-hint">{RISK.high.words}.</p>
    </ConfirmDialog>
    <ConfirmDialog open={deleting !== null} tone="danger" icon="trash" requireText={deleting && deleting.permissions.length > 0 ? deleting.name : undefined} title={`Delete “${deleting?.name ?? ''}”?`} confirmLabel="Delete role" busy={busy} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={remove}>
      <p>The role is deleted for good. Nobody holds it, so no one loses access. Its history stays in the activity log.</p>
    </ConfirmDialog>
  </div>;
}
