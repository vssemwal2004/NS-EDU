'use client';
// Dashboard insights (GET /crm/dashboard): one filter bar — period and team member, remembered per person — drives
// every chart below it. Refreshes itself every 2 minutes while the tab is visible, so the numbers stay current
// through the day. Sections: headline KPIs, health tiles, lead trend, sources, pipeline + donut, conversion funnel,
// temperature, lead aging, response time, team leaderboard, activity heatmap, top states and top schools.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { cx, dayLong, dayShort, ErrorBanner, n, rangeText, useTick } from '../analytics/shared';
import { CHANNELS } from '../crm/meta';
import { relativeTime } from '../crm/format';
import HeatmapPanel from '../crm-dashboard/HeatmapPanel';
import Leaderboard from '../crm-dashboard/Leaderboard';
import { AgingPanel, ResponsePanel, TemperaturePanel } from '../crm-dashboard/PipelinePanels';
import { useServerList } from '../table/useServerList';
import BarList from '../ui/BarList';
import TrendChart from '../ui/TrendChart';
import { useStickyState } from '../ui/useStickyState';
import { Card, Donut, Pipeline } from './charts';
import styles from '../Dashboard.module.css';

const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['month', 'This month'], ['custom', 'Custom']];
const PIPELINE = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted'];
const METRICS = [['leads', 'New leads'], ['firstContacts', 'First contacts'], ['activities', 'Activities logged']];
const REFRESH = 120_000;
const pct = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—');
const hours = (value) => (typeof value === 'number' ? (value < 1 ? `${Math.round(value * 60)} min` : `${value} h`) : '—');

function FilterBar({ filters, setFilters, people, data, busy, onRefresh }) {
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to });
  const set = (patch) => setFilters((current) => ({ ...current, ...patch }));
  const applyCustom = (event) => { event.preventDefault(); if (draft.from && draft.to && draft.from <= draft.to) set({ range: 'custom', from: draft.from, to: draft.to }); };
  return <div className={styles.filterBar} role="region" aria-label="Dashboard filters">
    <div className={styles.filterGroup}>
      <span className={styles.filterLabel}><Icon name="calendar" />Period</span>
      <div className={styles.segmented} role="radiogroup" aria-label="Period">
        {RANGES.map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={filters.range === key}
          onClick={() => (key === 'custom' ? set({ range: 'custom' }) : set({ range: key, from: '', to: '' }))}>{label}</button>)}
      </div>
    </div>
    {filters.range === 'custom' && <form className={styles.customRange} onSubmit={applyCustom}>
      <label>From<input type="date" className="adm-input" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} /></label>
      <label>To<input type="date" className="adm-input" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} /></label>
      <button type="submit" className="adm-btn adm-btn--sm adm-btn--primary" disabled={!draft.from || !draft.to || draft.from > draft.to}>Apply</button>
    </form>}
    {people.length > 0 && <label className={styles.filterGroup}>
      <span className={styles.filterLabel}><Icon name="people" />Team member</span>
      <select className="adm-select" value={filters.employee} onChange={(event) => set({ employee: event.target.value })}>
        <option value="">Everyone</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
      </select>
    </label>}
    <div className={styles.filterEnd}>
      {data?.range && <span className={styles.rangeNote}>{rangeText(data.range)}</span>}
      <span className={styles.live} data-busy={busy || undefined}><i />{busy ? 'Updating…' : data?.generatedAt ? `Updated ${relativeTime(data.generatedAt)}` : 'Live'}</span>
      <button type="button" className="adm-btn adm-btn--sm" onClick={onRefresh} disabled={busy}><Icon name="refresh" />Refresh</button>
    </div>
  </div>;
}

function Kpi({ tone, icon, label, value, note, delta, href }) {
  const body = <>
    <span className={styles.kpiTop}><span className={styles.kpiIcon}><Icon name={icon} /></span>
      {typeof delta === 'number' && <span className={styles.delta} data-dir={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%</span>}</span>
    <span className={styles.kpiLabel}>{label}</span>
    <strong className={cx(styles.kpiValue, 'crm-tabnum')}>{value}</strong>
    {note && <span className={styles.kpiNote}>{note}</span>}
  </>;
  return href ? <Link href={href} className={cx('crm-tone', styles.kpi)} data-tone={tone}>{body}</Link> : <div className={cx('crm-tone', styles.kpi)} data-tone={tone}>{body}</div>;
}

function Tile({ tone = 'neutral', label, value, href, hint }) {
  const inner = <><span>{label}</span><strong className="crm-tabnum">{value}</strong>{hint && <small>{hint}</small>}</>;
  return href ? <Link href={href} className={cx('crm-tone', styles.tile)} data-tone={tone}>{inner}</Link> : <div className={cx('crm-tone', styles.tile)} data-tone={tone}>{inner}</div>;
}

function Funnel({ steps }) {
  const first = steps[0]?.count || 0;
  const tones = ['info', 'purple', 'warn', 'orange', 'good'];
  return <Card title="Conversion funnel" meta="Leads that arrived in this period" className={styles.w4}>
    <ol className={styles.funnel}>
      {steps.map((step, index) => {
        const previous = index ? steps[index - 1].count : step.count;
        const rate = previous ? Math.round((step.count / previous) * 100) : 0;
        return <li key={step.key} className="crm-tone" data-tone={tones[index] ?? 'neutral'}>
          <span className={styles.funnelBar} style={{ width: `${first ? Math.max(4, (step.count / first) * 100) : 4}%` }} />
          <span className={styles.funnelText}><span>{step.label}</span><strong className="crm-tabnum">{n(step.count)}</strong></span>
          {index > 0 && <small className={styles.funnelRate}>{rate}% of the step before</small>}
        </li>;
      })}
    </ol>
  </Card>;
}

function Trend({ trend, range }) {
  const [metric, setMetric] = useStickyState('dashboard:trend', 'leads');
  const rows = useMemo(() => (trend?.days ?? []).map((day, index) => ({ key: day, value: trend?.[metric]?.[index] ?? 0, short: dayShort(day), long: dayLong(day) })), [trend, metric]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const label = METRICS.find(([key]) => key === metric)?.[1] ?? 'New leads';
  return <Card title="Trend" meta={`${n(total)} ${label.toLowerCase()} · ${rangeText(range)}`} className={styles.w8}
    action={<div className={styles.segmentedSmall} role="radiogroup" aria-label="What to chart">
      {METRICS.map(([key, text]) => <button key={key} type="button" role="radio" aria-checked={metric === key} onClick={() => setMetric(key)}>{text}</button>)}
    </div>}>
    <div className={styles.chartBody}>{rows.length ? <TrendChart data={rows} title={`${label} per day`} valueLabel={label} height={220} variant="line" /> : <p className={styles.empty}>No data for this period.</p>}</div>
  </Card>;
}

const panel = (node, span) => <div className={cx(styles.cell, styles[span])}>{node}</div>;

export default function Insights() {
  const { admin, request } = useAdminSession();
  useTick(60_000);
  const [filters, setFilters] = useStickyState('dashboard', { range: '30d', from: '', to: '', employee: '' });
  const [people, setPeople] = useState([]);
  const params = filters.range === 'custom' && filters.from && filters.to ? { from: filters.from, to: filters.to, employee: filters.employee } : { range: filters.range === 'custom' ? '30d' : filters.range, employee: filters.employee };
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/crm/dashboard', params, { scope: admin?.id ?? '' });

  useEffect(() => {
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((meta) => setPeople(meta?.assignees ?? [])).catch(() => {});
    return () => controller.abort();
  }, [request]);
  // Live: refresh every 2 minutes while the tab is visible.
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') reload(); }, REFRESH);
    return () => window.clearInterval(timer);
  }, [reload]);

  const employee = filters.employee;
  const person = people.find((item) => item.id === employee);
  const leadsLink = (query) => `/admin/leads?${new URLSearchParams({ ...query, ...(employee && { assignee: employee }) })}`;
  const k = data?.kpis ?? {};
  const byStatus = data?.byStatus ?? [];
  const stages = PIPELINE.map((status) => ({ status, count: byStatus.find((row) => row.status === status)?.count ?? 0 }));
  const sources = (data?.channels ?? []).map((row) => ({ key: row.key, label: row.label, value: row.leads, tone: CHANNELS[row.key]?.tone, hint: `${n(row.contacted)} contacted · ${n(row.admitted)} admitted · ${n(row.hot)} hot` }));
  const states = (data?.states ?? []).slice(0, 8).map((row) => ({ key: row.name, label: row.name || 'Not given', value: row.leads, hint: row.admitted ? `${n(row.admitted)} admitted` : undefined }));
  const schools = (data?.schools ?? []).slice(0, 8).map((row) => ({ key: row.name, label: row.name || 'Not given', value: row.leads }));
  const busyNow = loading || busy || refreshing;

  return <section className={styles.insights} aria-label="Insights">
    <header className={styles.insightsHead}>
      <div><p className="adm-eyebrow">Insights</p><h2>How the {person ? `work of ${person.name || person.email}` : 'team'} is going</h2></div>
    </header>
    <FilterBar filters={filters} setFilters={setFilters} people={people} data={data} busy={busyNow} onRefresh={reload} />
    {error && !data ? <ErrorBanner title="Insights could not load." message={error} onRetry={reload} />
      : !data ? <div className={styles.insightSkeleton} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
        : <div className={styles.insightsBody} data-busy={busyNow || undefined}>
          <div className={styles.kpiRow}>
            <Kpi tone="info" icon="inbox" label="New leads" value={n(k.leads?.value)} delta={k.leads?.delta} note={`${n(k.leads?.previous)} in the previous period`} href={leadsLink({})} />
            <Kpi tone="purple" icon="layers" label="Open leads" value={n(k.open)} note={`${n(k.totalLeads)} leads in total`} href={leadsLink({ status: 'new,contacted,in-progress,applied-to-university' })} />
            <Kpi tone="bad" icon="flame" label="Hot leads" value={n(k.hot)} note={`${n(k.warm)} warm · ${n(k.cold)} cold`} href={leadsLink({ heat: 'hot' })} />
            <Kpi tone="good" icon="cap" label="Admitted" value={n(k.admitted)} note={`${pct(k.admitRate)} of new leads`} href={leadsLink({ status: 'admitted' })} />
          </div>
          <div className={styles.tiles}>
            <Tile tone="info" label="Contact rate" value={pct(k.contactRate)} hint="New leads reached" />
            <Tile tone="purple" label="First response" value={hours(k.avgResponseHours)} hint="Average" />
            <Tile tone="good" label="Reached within 24 h" value={pct(k.within24Rate)} />
            <Tile tone="bad" label="Overdue follow-ups" value={n(k.overdueFollowUps)} href={leadsLink({ followUp: 'overdue' })} />
            <Tile tone="warn" label="Follow-ups due today" value={n(k.dueToday)} href={leadsLink({ followUp: 'today' })} />
            <Tile tone="orange" label="Never contacted" value={n(k.untouched)} href={leadsLink({ status: 'new' })} />
            <Tile tone="neutral" label="Lost or closed" value={n(data.lost)} href={leadsLink({ status: 'not-interested,closed' })} />
          </div>
          <div className={styles.grid}>
            <Trend trend={data.trend} range={data.range} />
            <Card title="Lead sources" meta="Where leads came from" className={styles.w4}><div className={styles.chartBody}><BarList rows={sources} total={k.leads?.value ?? 0} label="Lead sources" /></div></Card>
            <Pipeline stages={stages} title="Pipeline by stage" className={styles.w5} />
            <Donut stages={stages} className={styles.w3} />
            <Funnel steps={data.funnel ?? []} />
            {panel(<TemperaturePanel heat={data.heat} employee={employee} />, 'w4')}
            {panel(<AgingPanel aging={data.aging} employee={employee} />, 'w4')}
            {panel(<ResponsePanel kpis={k} trend={data.trend} />, 'w4')}
            {data.leaderboard?.length > 0 && panel(<Leaderboard rows={data.leaderboard} admin={admin} scope={data.scope} person={person?.name ?? ''} />, 'w12')}
            {panel(<HeatmapPanel heatmap={data.heatmap} />, 'w6')}
            <Card title="Top states" meta="By leads" className={styles.w3}><div className={styles.chartBody}><BarList rows={states} total={k.leads?.value ?? 0} label="Top states" /></div></Card>
            <Card title="Top schools" meta="School drives" className={styles.w3}><div className={styles.chartBody}><BarList rows={schools} total={k.leads?.value ?? 0} label="Top schools" emptyText="No school drive leads in this period" /></div></Card>
          </div>
        </div>}
  </section>;
}
