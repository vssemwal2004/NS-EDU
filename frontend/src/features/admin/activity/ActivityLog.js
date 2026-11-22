'use client';
// /admin/activity: one place for "who did what".
//  - Team activity: calls, messages, notes and stage changes on leads (GET /crm/activity), scoped like the leads list.
//  - Access changes: the audit log of staff, role, delete and export actions (the existing Activity tab of Team & access),
//    shown only to people holding audit.view.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminSession } from '../AdminSession';
import { can, canAny } from '../crm/meta';
import ActivityTab from '../access/ActivityTab';
import { ViewTabs } from '../ui/Page';
import ActivityFeed from './ActivityFeed';

const LEADS = ['leads.view_own', 'leads.view_team', 'leads.view_all'];

function AccessChanges({ request }) {
  const params = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request('/access/catalogue', { signal: controller.signal }), request('/access/staff', { signal: controller.signal }).catch(() => null)])
      .then(([catalogue, staff]) => setData({ catalogue, roles: [], staff: staff?.items ?? [] }))
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message || 'Could not load the access log.'); });
    return () => controller.abort();
  }, [request]);
  const setParams = useCallback((patch) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    const query = next.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);
  if (error) return <p role="alert" className="crm-muted">{error}</p>;
  if (!data) return <p className="crm-muted">Loading the access log…</p>;
  return <ActivityTab request={request} data={data} params={params} setParams={setParams} />;
}

export default function ActivityLog() {
  const { admin, request } = useAdminSession();
  const params = useSearchParams();
  const tabs = [
    canAny(admin, LEADS) && { key: 'team', label: 'Team activity', icon: 'people' },
    can(admin, 'audit.view') && { key: 'access', label: 'Access changes', icon: 'shield' },
  ].filter(Boolean);
  const [tab, setTab] = useState(() => (params.get('tab') === 'access' ? 'access' : 'team'));
  const active = tabs.find((item) => item.key === tab) ?? tabs[0];
  const choose = (key) => {
    setTab(key);
    const next = new URLSearchParams(window.location.search);
    if (key === 'team') next.delete('tab'); else next.set('tab', key);
    window.history.replaceState(null, '', `${window.location.pathname}${next.toString() ? `?${next}` : ''}`);
  };
  if (!active) return <p className="crm-muted">Your role cannot see an activity log.</p>;
  return <div style={{ display: 'grid', gap: 18 }}>
    {tabs.length > 1 && <ViewTabs label="Activity log sections" value={active.key} onChange={choose} items={tabs} />}
    {active.key === 'team' ? <ActivityFeed /> : <AccessChanges request={request} />}
  </div>;
}
