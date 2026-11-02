'use client';
// You: what the signed-in person can do, as a sheet. First a short definition list (role, mentor, team,
// visibility, what you manage), then every permission grouped by area with its state on the right.
import { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { displayName } from '@/features/admin/crm/format';
import { Panel } from '@/features/admin/ui/Page';
import { ANALYTICS_SCOPE_WORDS, LEAD_SCOPE_WORDS, adminKeys, groupPermissions, managesWords } from './access-model';
import access from './Access.module.css';
import styles from './You.module.css';

const nameOf = (person) => person.name || displayName(person.email);

export default function YouTab({ admin, data }) {
  const { catalogue, roles, staff } = data;
  const keys = useMemo(() => adminKeys(admin, catalogue), [admin, catalogue]);
  const role = roles.find((item) => item.slug === admin.roleId);
  const mentor = admin.managerId ? staff.find((person) => person.id === admin.managerId) : null;
  const team = staff.filter((person) => person.managerId === admin.id);
  const groups = useMemo(() => groupPermissions(catalogue), [catalogue]);
  const total = catalogue?.permissions?.length ?? 0;
  const allowed = (catalogue?.permissions ?? []).filter((permission) => keys.has(permission.key)).length;
  const none = <span className={access.muted}>—</span>;

  return <div className={styles.you}>
    <Panel title="Your access" description={role?.description || undefined}>
      <dl className={access.sheet}>
        <dt>Role</dt><dd><strong>{admin.roleName || role?.name || 'No role'}</strong></dd>
        <dt>Signed in as</dt><dd title={admin.email}>{nameOf(admin)}<span className={styles.muted}>{admin.email}</span></dd>
        <dt>Mentor</dt><dd>{mentor ? nameOf(mentor) : admin.managerId ? 'Assigned' : none}</dd>
        <dt>Your team</dt><dd title={team.map(nameOf).join(', ') || undefined}>{team.length ? `${team.length} ${team.length === 1 ? 'person' : 'people'}` : none}</dd>
        <dt>Leads you see</dt><dd>{LEAD_SCOPE_WORDS[admin.leadScope] ?? LEAD_SCOPE_WORDS.none}</dd>
        <dt>Analytics</dt><dd>{ANALYTICS_SCOPE_WORDS[admin.analyticsScope] ?? ANALYTICS_SCOPE_WORDS.none}</dd>
        <dt>You manage</dt><dd>{managesWords(keys)}</dd>
      </dl>
    </Panel>

    <Panel title="Permissions" meta={`${allowed} of ${total} allowed${admin.isOwner ? ' · owners hold every permission' : ''}`} flush>
      {groups.length ? <div className={styles.areas}>
        {groups.map((group) => <section key={group.id} className={styles.area} aria-labelledby={`you-${group.id}`}>
          <h3 id={`you-${group.id}`} className={access.sectionLabel}>{group.label}</h3>
          <dl>
            {group.permissions.map((permission) => {
              const on = keys.has(permission.key);
              return <div key={permission.key} className={styles.perm} title={permission.hint}>
                <dt>{permission.label}</dt>
                <dd data-on={on || undefined}>{on ? <><Icon name="check" />Allowed</> : <>No</>}</dd>
              </div>;
            })}
          </dl>
        </section>)}
      </div> : <p className={styles.none}>Your role has no permissions yet.</p>}
    </Panel>
  </div>;
}
