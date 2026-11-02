'use client';
// CRM performance (/admin/crm): how the pipeline and the people working it are doing.
// Volume, sources, places and the funnel live on Lead volume (/admin/leads/dashboard); the action lists live on the home.
import { useEffect, useMemo, useState } from 'react';
import { useAdminSession } from '@/features/admin/AdminSession';
import { displayName, formatHours } from '@/features/admin/crm/format';
import RangeToolbar from '@/features/admin/analytics/RangeToolbar';
import { ErrorBanner, n, PanelSkeletons, rangeText, readRangeParams, useUrlParams } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { useServerList } from '@/features/admin/table/useServerList';
import { StatStrip } from '@/features/admin/ui/Page';
import HeatmapPanel from './HeatmapPanel';
import Leaderboard from './Leaderboard';
import { AgingPanel, leadsHref, OPEN, ResponsePanel, responseTone, StagePanel, TemperaturePanel } from './PipelinePanels';

const SCOPE = { all: 'Company-wide', team: 'Your team', own: 'Your leads' };

export function readParams(source = {}) { return readRangeParams(source); }

export default function CrmDashboard({ initial }) {
  const { admin, request } = useAdminSession();
  const [params, choose] = useUrlParams('/admin/crm', readParams(initial));
  // `range=custom` tells the API the dates are a custom range.
  const apiParams = params.range ? params : { ...params, range: 'custom' };
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/crm/dashboard', apiParams, { scope: admin?.id ?? admin?.email ?? '' });
  const scope = data?.scope ?? admin?.analyticsScope ?? 'own';
  const canPick = (admin?.analyticsScope ?? scope) === 'all' || (admin?.analyticsScope ?? scope) === 'team';

  // People for the person filter: whoever the viewer may assign to, plus everyone on the unfiltered leaderboard.
  const [assignees, setAssignees] = useState([]);
  const [seen, setSeen] = useState({});
  useEffect(() => {
    if (!canPick) return undefined;
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((meta) => setAssignees(meta?.assignees ?? [])).catch(() => {});
    return () => controller.abort();
  }, [request, canPick]);
  useEffect(() => {
    if (!data?.leaderboard || params.employee) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remembered once per response so the select keeps its options after filtering
    setSeen((current) => ({ ...current, ...Object.fromEntries(data.leaderboard.map((row) => [row.id, row.email])) }));
  }, [data, params.employee]);
  const people = useMemo(() => {
    const map = new Map();
    for (const [id, email] of Object.entries(seen)) map.set(id, displayName(email));
    for (const person of assignees) map.set(person.id, person.name || displayName(person.email));
    if (params.employee && !map.has(params.employee)) map.set(params.employee, 'Selected person');
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [seen, assignees, params.employee]);

  const employee = params.employee ?? '';
  const withPerson = (base) => ({ ...base, ...(employee ? { employee } : {}) });
  const pickPerson = (id) => { const next = { ...params }; if (id) next.employee = id; else delete next.employee; choose(next); };
  const k = data?.kpis ?? {};
  const speed = responseTone(k.avgResponseHours);
  const range = data?.range;
  const personName = employee ? people.find((person) => person.id === employee)?.label : '';
  const summary = <>
    <strong>{personName || SCOPE[scope] || 'CRM'}</strong>{range ? ` · ${rangeText(range)} · ${n(range.days)} ${range.days === 1 ? 'day' : 'days'}` : ''}
  </>;

  return <div className={styles.page} data-testid="crm-dashboard">
    <RangeToolbar summary={summary} value={params} range={range} onChange={(next) => choose(withPerson(next))}
      people={canPick ? people : null} person={employee} onPerson={pickPerson} personLabel={scope === 'team' ? 'Whole team' : 'Everyone'}
      generatedAt={data?.generatedAt} busy={busy || refreshing} onRefresh={reload} />
    {error && !data ? <ErrorBanner title="CRM performance could not load." message={error} onRetry={reload} />
      : loading || !data ? <><StatStrip loading items={[1, 2, 3, 4, 5, 6].map((key) => ({ key, label: '…', value: 0 }))} /><PanelSkeletons spans={['', '', '', '', 'wide']} /></>
        : <>
          {error && <ErrorBanner title="Showing the last numbers that loaded." message={error} onRetry={reload} />}
          <StatStrip label="Pipeline right now" items={[
            { key: 'open', label: 'Open leads', value: k.open, icon: 'layers', tone: 'neutral', href: leadsHref({ status: OPEN }, employee) },
            { key: 'hot', label: 'Hot, open', value: k.hot, icon: 'flame', tone: 'bad', href: leadsHref({ heat: 'hot', status: OPEN }, employee) },
            { key: 'overdue', label: 'Overdue follow-ups', value: k.overdueFollowUps, icon: k.overdueFollowUps ? 'alert' : 'check', tone: k.overdueFollowUps ? 'bad' : 'good', href: leadsHref({ followUp: 'overdue' }, employee) },
            { key: 'today', label: 'Follow-ups due today', value: k.dueToday, icon: 'calendar', tone: 'warn', href: leadsHref({ followUp: 'today' }, employee) },
            { key: 'response', label: 'Avg first response', value: formatHours(k.avgResponseHours), icon: speed.icon, tone: speed.tone },
            { key: 'contact', label: 'Contact rate', value: typeof k.contactRate === 'number' ? `${k.contactRate}%` : '—', icon: 'phone', tone: 'neutral' },
          ]} />
          <div className={styles.grid} data-busy={busy || undefined} aria-busy={busy || undefined}>
            <StagePanel byStatus={data.byStatus} total={k.totalLeads} employee={employee} />
            <TemperaturePanel heat={data.heat} employee={employee} />
            <AgingPanel aging={data.aging} employee={employee} />
            <ResponsePanel kpis={k} trend={data.trend} />
            <Leaderboard rows={data.leaderboard} admin={admin} scope={scope} person={personName} />
            <HeatmapPanel heatmap={data.heatmap} />
          </div>
        </>}
  </div>;
}
