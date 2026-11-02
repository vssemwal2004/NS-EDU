'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminSession } from '@/features/admin/AdminSession';
import { displayName } from '@/features/admin/crm/format';

// Quick views are presets of the API filters, shown as the clickable strip above the leads table.
// `keys` are the filters a view owns: choosing a view clears all of them (and the stage), then applies
// its own `params`. Counts come from GET /leads/view-counts (same keys; the API mirrors these params).
export const QUICK_VIEWS = [
  { key: 'hot', label: 'Hot', icon: 'flame', tone: 'bad', params: { heat: 'hot' } },
  { key: 'today', label: 'Follow-up today', icon: 'clock', tone: 'warn', params: { followUp: 'today' } },
  { key: 'overdue', label: 'Overdue', icon: 'alert', tone: 'bad', params: { followUp: 'overdue' } },
  { key: 'untouched', label: 'New & untouched', icon: 'inbox', tone: 'info', params: { status: 'new', idle: '2' } },
  { key: 'unassigned', label: 'Unassigned', icon: 'user', tone: 'neutral', params: { assignee: 'unassigned' }, needs: 'wide' },
  { key: 'mine', label: 'Mine', icon: 'target', tone: 'neutral', params: { assignee: 'me' }, needs: 'wide' },
];
const OWNED = ['heat', 'followUp', 'idle', 'assignee'];

/** The views this person can use: assignment views only make sense when they see more than their own leads. */
export const viewsFor = (admin) => QUICK_VIEWS.filter((view) => !view.needs || admin?.leadScope === 'all' || admin?.leadScope === 'team');
export const viewKeys = (view) => [...OWNED, ...('status' in view.params ? ['status'] : [])];
export const CLEAR_VIEW = { heat: '', followUp: '', idle: '', assignee: '' };
export const viewPatch = (view) => ({ ...CLEAR_VIEW, status: '', ...view.params });
export const activeViewOf = (filters, views) => views.find((view) => viewKeys(view).every((key) => (filters[key] || '') === (view.params[key] || ''))) ?? null;

// GET /crm/meta (stages, assignees…) is the same for the whole visit; keep one copy per person.
const cache = new Map();
export function useCrmMeta() {
  const { admin, request } = useAdminSession();
  const id = admin?.id ?? '';
  const [fetched, setFetched] = useState(null);
  useEffect(() => {
    if (!id || cache.has(id)) return undefined;
    let live = true;
    request('/crm/meta').then((data) => { cache.set(id, data); if (live) setFetched(data); }).catch(() => {});
    return () => { live = false; };
  }, [id, request]);
  const meta = cache.get(id) ?? fetched;
  const assignees = useMemo(() => meta?.assignees ?? [], [meta]);
  const people = useMemo(() => new Map(assignees.map((person) => [person.id, person])), [assignees]);
  return { meta, assignees, people };
}

export const personName = (person) => person?.name || displayName(person?.email ?? '');

// ---- Saved views: named filter sets, per person, in this browser (localStorage). ----
// A view stores the list's URL query without paging, e.g. "heat=hot&status=new&sort=oldest".
const SAVED_LIMIT = 20;
const savedKey = (adminId) => `gv-admin-lead-views:v1:${adminId}`;
function readSaved(adminId) {
  if (!adminId) return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(savedKey(adminId)) || '[]');
    return Array.isArray(list) ? list.filter((view) => view && typeof view.id === 'string' && typeof view.name === 'string' && typeof view.query === 'string').slice(0, SAVED_LIMIT) : [];
  } catch { return []; }
}

/** [views, { save(name, query), rename(id, name), remove(id) }] — every write is persisted at once. */
export function useSavedViews(adminId) {
  const [views, setViews] = useState([]);
  // localStorage is read after mount so the server render and the first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setViews(readSaved(adminId)); }, [adminId]);
  const write = useCallback((next) => {
    setViews(next);
    try { window.localStorage.setItem(savedKey(adminId), JSON.stringify(next)); } catch { /* storage full or blocked: the views last for this visit */ }
  }, [adminId]);
  const actions = useMemo(() => ({
    save: (name, query) => {
      const clean = name.trim().slice(0, 40);
      const existing = views.find((view) => view.name.toLowerCase() === clean.toLowerCase());
      const view = { id: existing?.id ?? `v${Date.now().toString(36)}`, name: clean, query };
      write([view, ...views.filter((item) => item.id !== view.id)].slice(0, SAVED_LIMIT));
      return view;
    },
    rename: (id, name) => write(views.map((view) => (view.id === id ? { ...view, name: name.trim().slice(0, 40) || view.name } : view))),
    remove: (id) => write(views.filter((view) => view.id !== id)),
  }), [views, write]);
  return [views, actions];
}
