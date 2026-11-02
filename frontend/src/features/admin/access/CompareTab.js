'use client';
// Compare roles: every permission (rows, grouped) against every role (columns). ✓ = allowed, — = not.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { PageToolbar } from '@/features/admin/ui/Page';
import { effectiveKeys, groupPermissions } from './access-model';
import { RiskMark } from './AccessParts';
import access from './Access.module.css';
import styles from './Compare.module.css';

export default function CompareTab({ data }) {
  const { catalogue, roles } = data;
  const [query, setQuery] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const sets = useMemo(() => new Map(roles.map((role) => [role.slug, effectiveKeys(role.permissions, catalogue)])), [roles, catalogue]);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groupPermissions(catalogue).map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => {
        if (needle && !`${permission.label} ${permission.hint}`.toLowerCase().includes(needle)) return false;
        if (!onlyDiff) return true;
        const held = roles.filter((role) => sets.get(role.slug)?.has(permission.key)).length;
        return held > 0 && held < roles.length;
      }),
    })).filter((group) => group.permissions.length);
  }, [catalogue, roles, sets, query, onlyDiff]);
  const rows = groups.reduce((sum, group) => sum + group.permissions.length, 0);

  return <>
    <PageToolbar summary={<><strong className="crm-tabnum">{roles.length}</strong> roles · <span className="crm-tabnum">{rows}</span> of {catalogue.permissions.length} permissions</>} start={<>
      <label className={access.search}><Icon name="search" /><span className="sr-only">Search permissions</span>
        <input type="search" className="adm-input" value={query} placeholder="Search permissions" onChange={(event) => setQuery(event.target.value)} /></label>
      <label className={styles.check}><input type="checkbox" checked={onlyDiff} onChange={(event) => setOnlyDiff(event.target.checked)} />Only differences</label>
    </>} />
    <div className={`adm-panel ${styles.panel}`}>
      {rows ? <div className={styles.scroll} tabIndex={0} role="region" aria-label="Permissions by role">
        <table className={styles.matrix}>
          <thead><tr>
            <th scope="col" className={styles.corner}>Permission</th>
            {roles.map((role) => <th key={role.slug} scope="col" title={role.description || role.name}><span className={styles.colHead}>{role.name}</span></th>)}
          </tr></thead>
          {groups.map((group) => <tbody key={group.id}>
            <tr className={styles.groupRow}><th scope="rowgroup" colSpan={roles.length + 1}><span>{group.label}</span></th></tr>
            {group.permissions.map((permission) => <tr key={permission.key}>
              <th scope="row" title={permission.hint}><span className={styles.perm}>{permission.label}<RiskMark risk={permission.risk} /></span></th>
              {roles.map((role) => {
                const allowed = sets.get(role.slug)?.has(permission.key);
                return <td key={role.slug} data-on={allowed || undefined}>
                  {allowed ? <><Icon name="check" /><span className="sr-only">Allowed</span></> : <><span aria-hidden="true">—</span><span className="sr-only">Not allowed</span></>}
                </td>;
              })}
            </tr>)}
          </tbody>)}
        </table>
      </div>
        : <div className={access.empty}><strong>No permissions match.</strong><button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setOnlyDiff(false); }}>Clear</button></div>}
    </div>
  </>;
}
