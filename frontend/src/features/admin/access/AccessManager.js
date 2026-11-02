'use client';
/**
 * Team & access. The shell already shows the page title; this screen starts with its own tabs:
 * Members (team), Roles, Compare roles, Activity and You. Tabs follow `?tab=` (old `overview` → `you`)
 * and appear only when the signed-in person may use them; the API enforces the same rules.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminSession } from '@/features/admin/AdminSession';
import { canAny } from '@/features/admin/crm/meta';
import { useToaster } from '@/features/admin/crm/toast';
import { ViewTabs } from '@/features/admin/ui/Page';
import ActivityTab from './ActivityTab';
import { ConfirmDialog, ErrorPanel, TableSkeleton } from './AccessParts';
import CompareTab from './CompareTab';
import RolesTab from './RolesTab';
import TeamTab from './TeamTab';
import YouTab from './YouTab';
import styles from './Access.module.css';

const PEOPLE = ['team.view', 'team.manage'];
const ROLES = ['team.view', 'team.manage', 'roles.manage'];
const CATALOGUE = [...ROLES, 'audit.view'];
const TABS = [
  { key: 'team', label: 'Members', icon: 'people', allowed: (admin) => canAny(admin, PEOPLE), View: TeamTab },
  { key: 'roles', label: 'Roles', icon: 'key', allowed: (admin) => canAny(admin, ROLES), View: RolesTab },
  { key: 'compare', label: 'Compare roles', icon: 'compare', allowed: (admin) => canAny(admin, ROLES), View: CompareTab },
  { key: 'activity', label: 'Activity', icon: 'history', allowed: (admin) => canAny(admin, ['audit.view']), View: ActivityTab },
  { key: 'you', label: 'You', icon: 'user', allowed: () => true, View: YouTab },
];
const ALIASES = { overview: 'you', members: 'team' };
const EMPTY = { catalogue: null, roles: [], staff: [] };

export default function AccessManager() {
  const { admin, request } = useAdminSession();
  const router = useRouter();
  const params = useSearchParams();
  const toaster = useToaster();
  const notify = useCallback((message, tone = 'success', options) => (tone === 'error' ? toaster.error(message, options) : toaster.success(message, options)), [toaster]);
  const tabs = useMemo(() => TABS.filter((tab) => tab.allowed(admin)), [admin]);
  const asked = params.get('tab');
  const wanted = ALIASES[asked] ?? asked;
  const fallback = tabs.find((tab) => tab.key === 'team') ?? tabs.find((tab) => tab.key === 'you');
  const active = tabs.find((tab) => tab.key === wanted) ?? fallback;
  const [data, setData] = useState({ ...EMPTY, status: 'loading', error: null });
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(null);

  const needsCatalogue = canAny(admin, CATALOGUE);
  const needsRoles = canAny(admin, ROLES);
  const needsStaff = canAny(admin, PEOPLE);
  const load = useCallback(async (signal) => {
    if (!needsCatalogue) { setData({ ...EMPTY, status: 'ready', error: null }); return; }
    try {
      const [catalogue, roles, staff] = await Promise.all([
        request('/access/catalogue', { signal }),
        needsRoles ? request('/access/roles', { signal }) : null,
        needsStaff ? request('/access/staff', { signal }) : null,
      ]);
      // Owner first, then built-in roles, then custom ones, each by name.
      const rank = (role) => (role.slug === 'owner' ? 0 : role.system ? 1 : 2);
      const sorted = [...(roles?.items ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      setData({ catalogue, roles: sorted, staff: staff?.items ?? [], status: 'ready', error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setData((previous) => ({ ...previous, status: 'error', error }));
    }
  }, [needsCatalogue, needsRoles, needsStaff, request]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Reload after a change without blanking the screen: old data stays until the new data arrives.
  const reload = useCallback(() => load(), [load]);
  const retry = () => { setData((previous) => ({ ...previous, status: 'loading', error: null })); load(); };

  // Keep the URL tidy: an old `?tab=overview` or a tab this person cannot open becomes the real tab.
  useEffect(() => {
    if (!active || asked === active.key || (!asked && active === fallback)) return;
    const next = new URLSearchParams(window.location.search);
    next.set('tab', active.key);
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`);
  }, [active, asked, fallback]);

  // Leaving with unsaved role edits: browser tab/close, and in-app links (sidebar, breadcrumb, palette results).
  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving({ href: url.pathname + url.search });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', onClick, true); };
  }, [dirty]);

  // `replaceState(null, …)`: Next syncs useSearchParams with native history calls only when the state is not its own.
  const setParams = useCallback((patch) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    const query = next.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);
  const switchTo = useCallback((key, extra = {}) => { setDirty(false); setParams({ tab: key, add: null, actor: null, ...extra }); }, [setParams]);
  const selectTab = (key) => { if (key === active?.key) return; if (dirty) setLeaving({ tab: key }); else switchTo(key); };
  // From a Members row menu: open Activity filtered to that person.
  const viewActivity = useCallback((email) => switchTo('activity', { actor: email }), [switchTo]);
  const confirmLeave = () => {
    const target = leaving;
    setLeaving(null); setDirty(false);
    if (target.tab) switchTo(target.tab);
    else router.push(target.href);
  };

  if (!active) return <ErrorPanel title="Nothing here for your role" error={{ message: 'Your role has no access to Team & access. Ask an owner if you need it.' }} />;
  const View = active.View;
  return <div className={styles.page}>
    {tabs.length > 1 && <ViewTabs label="Team and access sections" value={active.key} onChange={selectTab} items={tabs.map(({ key, label, icon }) => ({ key, label, icon }))} />}
    <div role="tabpanel" aria-label={active.label} className={styles.panel}>
      {data.status === 'loading' ? <TableSkeleton rows={8} />
        : data.status === 'error' ? <ErrorPanel error={data.error} onRetry={retry} />
          : <View admin={admin} request={request} data={data} reload={reload} notify={notify} onDirty={setDirty}
            onViewActivity={viewActivity} params={params} setParams={setParams} onSwitch={switchTo} />}
    </div>
    <ConfirmDialog open={leaving !== null} tone="danger" title="Leave without saving?" confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setLeaving(null)} onConfirm={confirmLeave}>
      <p>You have unsaved changes to a role. If you leave now they will be lost.</p>
    </ConfirmDialog>
  </div>;
}
