'use client';
// Lead volume (/admin/leads/dashboard): how many leads arrive, from where, and how far they get.
// Pipeline health and people's performance live on CRM performance (/admin/crm).
import { useState } from 'react';
import { useAdminSession } from '@/features/admin/AdminSession';
import { displayName } from '@/features/admin/crm/format';
import RangeToolbar from '@/features/admin/analytics/RangeToolbar';
import { dayShort, ErrorBanner, InfoHint, n, PanelLink, PanelSkeletons, rangeText, readRangeParams, TableToggle, trendRows, useUrlParams } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { toQuery, useServerList } from '@/features/admin/table/useServerList';
import BarList, { formatShare } from '@/features/admin/ui/BarList';
import { Panel, StatStrip } from '@/features/admin/ui/Page';
import TrendChart from '@/features/admin/ui/TrendChart';

const MAX_DAYS = 400;
// Presets the leads list also understands; any other range links to it by dates.
const LIST_RANGES = ['today', '7d', '30d', 'month'];
const leadsHref = (params) => { const query = toQuery(params); return query ? `/admin/leads?${query}` : '/admin/leads'; };
const rangeParams = (range) => (range && LIST_RANGES.includes(range.preset) ? { range: range.preset } : range ? { from: range.from, to: range.to } : {});
// "Reached this step or later", as status lists the leads list can filter on (so each count equals its list).
const FUNNEL = [
  { key: 'received', label: 'Received', statuses: null },
  { key: 'contacted', label: 'Contacted or later', statuses: ['contacted', 'in-progress', 'applied-to-university', 'admitted', 'not-interested', 'closed'] },
  { key: 'progress', label: 'In progress or later', statuses: ['in-progress', 'applied-to-university', 'admitted'] },
  { key: 'applied', label: 'Applied to university', statuses: ['applied-to-university', 'admitted'] },
  { key: 'admitted', label: 'Admitted', statuses: ['admitted'] },
];

export function readRange(source = {}) { return readRangeParams(source); }

/** One breakdown panel with its list link. */
/** `description` is the ⓘ hint; `meta` a short data line ("Top 10"), kept short so the header stays one line. */
function Breakdown({ title, description, meta, href, children }) {
  return <Panel title={title} {...(meta ? { meta: <><InfoHint text={description} />{meta}</> } : { description })} actions={href && <PanelLink href={href} label={title}>View leads</PanelLink>}>{children}</Panel>;
}

export default function LeadsDashboard({ initial }) {
  const { admin, request } = useAdminSession();
  const [params, choose] = useUrlParams('/admin/leads/dashboard', readRange(initial));
  const [table, setTable] = useState(false);
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/leads/insights', params, { scope: admin?.id ?? admin?.email ?? '' });

  const employee = params.employee ?? '';
  const person = employee ? { assignee: employee } : {};
  const pickPerson = (id) => { const next = { ...params }; if (id) next.employee = id; else delete next.employee; choose(next); };
  const range = data?.range;
  const scope = { ...rangeParams(range), ...person };
  const total = data?.total ?? 0;
  const kpis = data?.kpis ?? {};
  const trend = trendRows(data?.trend ?? []);
  const peak = (data?.trend ?? []).reduce((best, item) => (item.count > (best?.count ?? 0) ? item : best), null);
  const statusCount = Object.fromEntries((data?.byStatus ?? []).map((row) => [row.value, row.count]));
  const funnel = FUNNEL.map((step) => ({
    key: step.key, label: step.label,
    value: step.statuses ? step.statuses.reduce((sum, status) => sum + (statusCount[status] ?? 0), 0) : total,
    href: leadsHref({ ...scope, ...(step.statuses ? { status: step.statuses.join(',') } : {}) }),
  })).map((row, index) => ({ ...row, share: index ? `${formatShare(row.value, total) || '0%'}` : '' }));
  const lost = (statusCount['not-interested'] ?? 0) + (statusCount.closed ?? 0);
  const people = data?.people ? data.people.map((item) => ({ id: item.id, label: item.name || displayName(item.email) })) : null;
  const personName = employee ? people?.find((item) => item.id === employee)?.label ?? 'Selected person' : '';
  const isAll = admin?.leadScope === 'all';
  const rows = (list, toRow) => (total ? (list ?? []).map(toRow) : []);
  const empty = 'No leads in this range';
  const summary = <><strong>{personName || (isAll ? 'All leads' : admin?.leadScope === 'team' ? 'Your team’s leads' : 'Your leads')}</strong>{range ? ` · ${rangeText(range)} · ${n(range.days)} ${range.days === 1 ? 'day' : 'days'}` : ''}</>;

  return <div className={styles.page}>
    <RangeToolbar summary={summary} value={params} range={range} maxDays={MAX_DAYS} onChange={(next) => choose({ ...next, ...(employee ? { employee } : {}) })}
      people={people} person={employee} onPerson={pickPerson} personLabel={isAll ? 'Everyone' : 'Whole team'}
      generatedAt={data?.generatedAt} busy={busy || refreshing} onRefresh={reload} />
    {error && !data ? <ErrorBanner title="Lead volume could not load." message={error} onRetry={reload} />
      : loading || !data ? <><StatStrip loading items={[1, 2, 3, 4, 5].map((key) => ({ key, label: '…', value: 0 }))} /><PanelSkeletons /></>
        : <>
          {error && <ErrorBanner title="Showing the last numbers that loaded." message={error} onRetry={reload} />}
          <StatStrip label="Lead volume" items={[
            { key: 'range', label: `Leads in ${range?.days ?? ''} ${range?.days === 1 ? 'day' : 'days'}`, value: total, icon: 'inbox', tone: 'neutral', href: leadsHref(scope) },
            { key: 'today', label: 'Today', value: kpis.today ?? '—', icon: 'calendar', tone: 'neutral', href: leadsHref({ range: 'today', ...person }) },
            { key: 'yesterday', label: 'Yesterday', value: kpis.yesterday ?? '—', icon: 'history', tone: 'neutral', href: leadsHref({ range: 'yesterday', ...person }) },
            { key: 'average', label: 'Daily average', value: range?.days ? (total / range.days).toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—', icon: 'trend', tone: 'neutral' },
            { key: 'peak', label: peak ? `Busiest day · ${dayShort(peak.date)}` : 'Busiest day', value: peak?.count ?? 0, icon: 'bars', tone: 'neutral', href: peak ? leadsHref({ from: peak.date, to: peak.date, ...person }) : undefined },
            typeof data.unassigned === 'number' && { key: 'unassigned', label: 'Not assigned', value: data.unassigned, icon: 'user', tone: data.unassigned ? 'warn' : 'good', href: leadsHref({ ...scope, assignee: 'unassigned' }) },
          ]} />
          <div className={styles.grid} data-busy={busy || undefined} aria-busy={busy || undefined}>
            <Panel className={styles.wide} title="Leads per day" meta={<><InfoHint text="New leads received each day, India time. Hover or use the arrow keys to read a day." />{total ? `${n(total)} leads${peak ? ` · busiest ${dayShort(peak.date)} (${n(peak.count)})` : ''}` : `No leads in ${rangeText(range) || 'this range'}`}</>}
              actions={<><TableToggle table={table} onChange={setTable} /><PanelLink href={leadsHref(scope)} label="Leads per day">View leads</PanelLink></>}>
              <TrendChart data={trend} title={`Leads per day, ${rangeText(range)}`} height={180} table={table} />
            </Panel>
            <Breakdown title="Sources" description="Where this range’s leads came from" href={leadsHref(scope)}>
              <BarList label="Leads by source" total={total} emptyText={empty} rows={rows(data.byChannel, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, channel: row.value }) }))} />
            </Breakdown>
            <Breakdown title="Funnel" description="How far this range’s leads have got: each step counts leads at that stage or later, as a share of those received">
              {total ? <><BarList label="Funnel steps" total={total} rows={funnel} />
                <dl className={styles.footRow}><dt>Lost or not interested</dt><dd>{n(lost)}</dd><dd>{formatShare(lost, total) || '0%'}</dd></dl></>
                : <BarList rows={[]} emptyText={empty} />}
            </Breakdown>
            <Breakdown title="School drives" description="QR registrations per school drive" meta="Top 10" href={leadsHref({ ...scope, channel: 'school-drive' })}>
              <BarList label="School drive registrations by drive" total={total} emptyText="No school drive registrations in this range" rows={rows(data.bySchool, (row) => ({
                key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, form: row.value }),
                hint: [row.title && row.title !== row.label ? row.title : '', [row.district, row.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
              }))} />
            </Breakdown>
            <Breakdown title="States" description="The applicant’s state" meta="Top 12" href={leadsHref(scope)}>
              <BarList label="Leads by applicant state" total={total} emptyText={empty} rows={rows(data.byState, (row) => ({ key: row.value || '-', label: row.label, value: row.count, href: row.value ? leadsHref({ ...scope, state: row.value }) : undefined }))} />
            </Breakdown>
            <Breakdown title="Courses" description="Course chosen on website applications" meta="Top 10" href={leadsHref({ ...scope, channel: 'web-apply' })}>
              <BarList label="Website applications by course" total={total} emptyText="No course chosen on website applications in this range" rows={rows(data.byCourse, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, course: row.value }) }))} />
            </Breakdown>
            <Breakdown title="Career fields" description="Career field on counsellor callback requests" meta="Top 10" href={leadsHref({ ...scope, channel: 'callback' })}>
              <BarList label="Counsellor callbacks by career field" total={total} emptyText="No counsellor callbacks in this range" rows={rows(data.byCareerField, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, careerField: row.value }) }))} />
            </Breakdown>
          </div>
        </>}
  </div>;
}
