'use client';
// Search insights (/admin/insights): what opted-in visitors search for and open, and the gaps in the directory.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import RangeToolbar from '@/features/admin/analytics/RangeToolbar';
import { Empty, ErrorBanner, fillDays, InfoHint, n, PanelLink, PanelSkeletons, TableToggle, trendRows, useUrlParams } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { useServerList } from '@/features/admin/table/useServerList';
import BarList from '@/features/admin/ui/BarList';
import { Panel, StatStrip, ViewTabs } from '@/features/admin/ui/Page';
import TrendChart from '@/features/admin/ui/TrendChart';
import ConsentPanel from './ConsentPanel';

const WINDOWS = ['7d', '30d', '90d'];
const PAGE_SIZE = 25;
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const catalogue = (q) => `/admin/institutions?q=${encodeURIComponent(q)}`;


/** A ranked list with a dimension switch (states / cities, streams / courses). */
function SwitchPanel({ title, description, views, rows, empty }) {
  const [view, setView] = useState(views[0].key);
  const list = (rows[view] ?? []).slice(0, 10);
  return <Panel title={title} description={description} actions={<ViewTabs label={title} value={view} onChange={setView} items={views} />}>
    <BarList label={`${title}: ${views.find((item) => item.key === view)?.label}`} unit="events" emptyText={empty} rows={list.map((row) => ({ key: row.value, label: row.value, value: row.count }))} />
  </Panel>;
}

export default function InsightsDashboard({ initial = {} }) {
  const { admin, request } = useAdminSession();
  const startRange = WINDOWS.includes(String(initial.range)) ? String(initial.range) : '7d';
  const [params, choose] = useUrlParams('/admin/insights', { range: startRange }, '7d');
  const days = Number.parseInt(params.range, 10) || 7;
  const [gapsOnly, setGapsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [table, setTable] = useState(false);
  const scope = admin?.id ?? '';
  const overview = useServerList(request, '/insights/overview', { days }, { scope });
  const consent = useServerList(request, '/insights/consent', { days }, { scope });
  const gaps = useServerList(request, '/insights/searches', { days, noResults: 'true', page: 1, limit: PAGE_SIZE }, { scope });
  const searches = useServerList(request, '/insights/searches', { days, page, limit: PAGE_SIZE, ...(gapsOnly ? { noResults: 'true' } : {}) }, { scope });
  const data = overview.data;
  const reload = () => { overview.reload(); consent.reload(); gaps.reload(); searches.reload(); };
  const busy = overview.busy || overview.refreshing || consent.busy;
  const pages = Math.max(1, Math.ceil((searches.data?.total ?? 0) / PAGE_SIZE));
  const searchCount = data?.byType?.find((row) => row.value === 'search')?.count ?? 0;
  const est = consent.data?.estimatedVisitors;
  const pick = (next) => { setPage(1); choose(next); };

  return <div className={styles.page}>
    <RangeToolbar summary={<><strong>Opted-in visitors</strong> · last {days} days</>} value={params} onChange={pick} presets={WINDOWS} allowCustom={false}
      generatedAt={data?.generatedAt} busy={busy} onRefresh={reload} />
    {overview.error && !data ? <ErrorBanner title="Search insights could not load." message={overview.error} onRetry={reload} />
      : overview.loading || !data ? <><StatStrip loading items={[1, 2, 3, 4, 5, 6].map((key) => ({ key, label: '…', value: 0 }))} /><PanelSkeletons spans={['half', 'half', '', '', '', 'wide']} /></>
        : <>
          <StatStrip label="Search activity" items={[
            { key: 'events', label: 'Events recorded', value: data.total, icon: 'chart', tone: 'neutral' },
            { key: 'searches', label: 'Searches', value: searchCount, icon: 'search', tone: 'neutral' },
            { key: 'gaps', label: 'Searches with no results', value: gaps.data?.total ?? '—', icon: 'alert', tone: gaps.data?.total ? 'warn' : 'good', onClick: () => { setGapsOnly(true); setPage(1); document.getElementById('searches')?.scrollIntoView({ behavior: 'smooth' }); }, active: gapsOnly },
            { key: 'students', label: 'From signed-in students', value: data.fromSignedIn, icon: 'user', tone: 'neutral' },
            { key: 'visitors', label: 'From visitors', value: data.fromVisitors, icon: 'people', tone: 'neutral' },
            { key: 'estimate', label: 'Estimated visitors', value: typeof est === 'number' ? `≈ ${n(est)}` : '—', icon: 'eye', tone: 'neutral' },
          ]} />
          <div className={styles.grid} data-busy={overview.busy || undefined}>
            <Panel className={styles.half} title="Daily active students" description="Signed-in students who searched or opened a university"
              actions={data.dailyStudents?.length > 0 && <TableToggle table={table} onChange={setTable} />}>
              {data.dailyStudents?.length ? <TrendChart data={trendRows(fillDays(data.dailyStudents, days), 'day')} title={`Daily active students, last ${days} days`} valueLabel="Students" height={240} table={table} />
                : <Empty title="No signed-in activity in this window" />}
            </Panel>
            <ConsentPanel className={styles.half} data={consent.data} />
            <Panel title="Most viewed universities" meta={<><InfoHint text="University profiles opened by opted-in visitors. Click a row to find it in the directory." />Top 10</>}>
              <BarList label="Most viewed universities" unit="views" emptyText="No profile views in this window"
                rows={(data.topViewed ?? []).slice(0, 10).map((row) => ({ key: row.slug, label: row.name, title: [row.name, row.place].filter(Boolean).join(' · '), value: row.count, href: catalogue(row.name) }))} />
            </Panel>
            <SwitchPanel title="Where students look" description="Places in searches and filters" empty="No place in searches yet"
              views={[{ key: 'states', label: 'States' }, { key: 'cities', label: 'Cities' }]} rows={data} />
            <SwitchPanel title="What they want to study" description="Streams and courses in filters and the apply flow" empty="No stream or course chosen yet"
              views={[{ key: 'streams', label: 'Streams' }, { key: 'courses', label: 'Courses' }]} rows={data} />
            <section id="searches" className={styles.wide}>
              <Panel title={gapsOnly ? 'Searches that found nothing' : 'Top searches'} flush
                meta={`${n(searches.data?.total)} distinct ${gapsOnly ? 'searches · what the directory is missing' : 'searches'}`}
                actions={<ViewTabs label="Searches" value={gapsOnly ? 'gaps' : 'all'} onChange={(value) => { setGapsOnly(value === 'gaps'); setPage(1); }}
                  items={[{ key: 'all', label: 'All searches' }, { key: 'gaps', label: 'No results', count: gaps.data?.total }]} />}>
                {searches.data?.items?.length ? <div className={styles.tableWrap} role="region" aria-label="Searches" tabIndex={0}>
                  <table className={styles.table}>
                    <thead><tr><th scope="col">Search</th><th scope="col">Last seen</th><th scope="col" data-num="">Times</th></tr></thead>
                    <tbody>{searches.data.items.map((row) => <tr key={row.query}>
                      <td className={styles.truncate}><Link className={styles.personLink} href={catalogue(row.query)} title={`Look for “${row.query}” in the directory`}>{row.query}</Link></td>
                      <td>{row.lastAt ? dateTime.format(new Date(row.lastAt)) : <span className={styles.zero}>—</span>}</td>
                      <td data-num="">{n(row.count)}</td>
                    </tr>)}</tbody>
                  </table>
                </div> : searches.data ? <Empty title={gapsOnly ? 'Every search in this window found results' : 'No searches in this window'} />
                  : <div className={styles.skeletonPanel} aria-hidden="true"><span /><span /><span /></div>}
                {pages > 1 && <nav className={styles.pager} aria-label="Searches pages">
                  <span>Page {page} of {n(pages)}</span>
                  <div>
                    <button type="button" className="adm-btn adm-btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                    <button type="button" className="adm-btn adm-btn--sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
                  </div>
                </nav>}
              </Panel>
            </section>
            <Panel className={styles.wide} title="About this data" actions={<PanelLink href="/admin/students" label="one student’s own history">Student accounts</PanelLink>}>
              <p className={styles.privacy}><Icon name="shield" /><span>Only visitors who chose “Accept all” are recorded: searches, filters and universities opened — never IP addresses, browsers or full web addresses — deleted after {data.retentionDays ?? 180} days.</span></p>
            </Panel>
          </div>
        </>}
  </div>;
}
