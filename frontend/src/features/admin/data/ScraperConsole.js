'use client';
// Data pipeline › Scraper: crawl sources and the job queue. Crawling itself runs in a server-side worker
// (`npm run scrape -- work`); this screen queues, retries and cancels jobs and manages the sources.
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import ConfirmDialog from '../crm/ConfirmDialog';
import RowMenu from '../crm/RowMenu';
import { useToaster } from '../crm/toast';
import { PageToolbar, StatStrip, ViewTabs } from '../ui/Page';
import { formatCount, formatDate } from './data-api';
import JobsPanel from './JobsPanel';
import SourcesPanel from './SourcesPanel';
import { EmptyState, FormSkeleton } from '../catalogue/CatalogueParts';
import styles from '../catalogue/Catalogue.module.css';

const RUN_MODES = { never: 'Never crawled', stale: 'Over 30 days old', all: 'All active', selected: 'Chosen by hand' };
const ENQUEUE = [
  { mode: 'never', label: 'Never-crawled sources', hint: 'new' },
  { mode: 'stale', label: 'Last crawled over 30 days ago', hint: 'refresh', staleDays: 30 },
  { mode: 'all', label: 'Every active source…', hint: 'slow', confirm: true },
];

export default function ScraperConsole() {
  const { request } = useAdminSession();
  const toast = useToaster();
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('sources');
  const [jobStatus, setJobStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  // Counts refresh every 20 s while the tab is visible, so worker progress shows without reloading.
  const loadStats = useCallback(() => Promise.all([request('/data-ops/scraper/stats'), request('/data-ops/scraper/runs?limit=8')])
    .then(([nextStats, nextRuns]) => { setStats(nextStats); setRuns(nextRuns.items); setError(''); })
    .catch((failure) => setError(failure.message)), [request]);
  useEffect(() => {
    const first = window.setTimeout(loadStats, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') loadStats(); }, 20_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [loadStats]);
  const refresh = useCallback(() => { loadStats(); setReloadKey((key) => key + 1); }, [loadStats]);

  const enqueue = useCallback(async (body, after) => {
    setBusy(true); setConfirmAll(false);
    try {
      const result = await request('/data-ops/scraper/enqueue', { method: 'POST', body });
      if (result.queued) toast.success(`${formatCount(result.queued)} job${result.queued === 1 ? '' : 's'} queued${result.alreadyQueued ? `; ${formatCount(result.alreadyQueued)} already had an open job` : ''}. A worker on the server crawls them.`);
      else toast.info(`Nothing new to queue: ${formatCount(result.selected)} matching source${result.selected === 1 ? '' : 's'} already queued.`);
      after?.();
      refresh();
    } catch (failure) { toast.error(failure.message); }
    setBusy(false);
  }, [refresh, request, toast]);

  const jobs = stats?.jobs;
  const workers = stats?.workers?.length ?? 0;
  const showJobs = (status) => { setTab('jobs'); setJobStatus(status); };
  const jobStat = (key, label, icon, tone) => ({ key, label, value: jobs?.[key] ?? 0, icon, tone, onClick: () => showJobs(key), active: tab === 'jobs' && jobStatus === key });

  return <div className={styles.screen}>
    <PageToolbar summary={stats ? <>{workers ? <><strong>{workers}</strong> worker{workers === 1 ? '' : 's'} crawling</> : <>No worker running · queued jobs wait for <code>npm run scrape -- work</code></>}</> : 'Loading the crawler status…'}>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon" onClick={refresh} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
      <RowMenu label="Queue a crawl" className={styles.menuButton} trigger={<><Icon name="play" /><span>{busy ? 'Queueing…' : 'Queue crawl'}</span></>}
        items={[{ heading: 'Queue one job per source' }, ...ENQUEUE.map((option) => ({ key: option.mode, label: option.label, hint: option.hint, icon: 'play', disabled: busy,
          onSelect: () => (option.confirm ? setConfirmAll(true) : enqueue({ mode: option.mode, staleDays: option.staleDays })) }))]} />
    </PageToolbar>

    {error && <p className={styles.alert} role="alert"><Icon name="alert" />{error}<button type="button" className="adm-btn adm-btn--sm" style={{ marginLeft: 'auto' }} onClick={refresh}>Try again</button></p>}

    <StatStrip label="Crawler queue" loading={!stats} items={[
      jobStat('queued', 'Queued', 'clock', 'info'),
      jobStat('running', 'Running', 'refresh', 'purple'),
      jobStat('done', 'Done', 'check', 'good'),
      jobStat('failed', 'Failed', 'alert', 'bad'),
      jobStat('skipped', 'Skipped', 'ban', 'warn'),
      { key: 'never', label: 'Never crawled', value: stats?.sources.neverCrawled ?? 0, icon: 'guidesGlobe' },
    ]} />

    <div style={{ marginBottom: 10 }}>
      <ViewTabs label="Scraper views" value={tab} onChange={(next) => { setTab(next); if (next === 'jobs') setJobStatus(''); }} items={[
        { key: 'sources', label: 'Sources', icon: 'guidesGlobe', count: stats?.sources.total },
        { key: 'jobs', label: 'Job queue', icon: 'layers', count: jobs ? Object.values(jobs).reduce((sum, value) => sum + value, 0) : undefined },
        { key: 'runs', label: 'Recent runs', icon: 'history' },
      ]} />
    </div>

    {tab === 'sources' && <SourcesPanel onChanged={loadStats} onEnqueue={enqueue} reloadKey={reloadKey} />}
    {tab === 'jobs' && <JobsPanel status={jobStatus} onStatus={setJobStatus} onChanged={loadStats} reloadKey={reloadKey} />}
    {tab === 'runs' && <div className={styles.card}>
      {!runs ? <div className={styles.runs}><FormSkeleton rows={3} /></div> : !runs.length ? <EmptyState title="No crawl runs yet. Queue a crawl to start one." />
        : <div className={styles.runs}><table className={styles.miniTable} style={{ fontSize: 'var(--crm-text-sm)' }}>
          <thead><tr><th scope="col">Queued</th><th scope="col">Sources</th><th scope="col">By</th><th scope="col" className={styles.num}>Done</th><th scope="col" className={styles.num}>Failed / skipped</th><th scope="col" className={styles.num}>Open</th></tr></thead>
          <tbody>{runs.map((run) => <tr key={run.id}>
            <td>{formatDate(run.createdAt)}</td><td>{RUN_MODES[run.mode] ?? run.mode}</td><td><span className={styles.truncate} title={run.createdBy}>{run.createdBy}</span></td>
            <td className={styles.num}>{formatCount(run.counts.done)}</td><td className={styles.num}>{formatCount(run.counts.failed + run.counts.skipped)}</td><td className={styles.num}>{formatCount(run.counts.queued + run.counts.running)}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>}

    <ConfirmDialog open={confirmAll} title="Queue every active source?" confirmLabel="Queue all" icon="play" busy={busy} onConfirm={() => enqueue({ mode: 'all' })} onCancel={() => setConfirmAll(false)}>
      <p>This queues {stats ? formatCount(stats.sources.active) : 'all'} active sources. With the default politeness settings one worker crawls a few hundred sites an hour, so a full run takes days. Prefer “Never-crawled” or “Over 30 days” for routine refreshes.</p>
    </ConfirmDialog>
  </div>;
}
