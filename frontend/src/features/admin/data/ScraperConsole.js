'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import { formatCount, formatDate } from './data-api';
import JobsPanel from './JobsPanel';
import SourcesPanel from './SourcesPanel';
import { useToast } from './useToast';
import styles from './DataOps.module.css';
import table from '../ResourceManager.module.css';

const ENQUEUE = [
  { mode: 'never', label: 'Never crawled', help: 'Sources without any crawl yet' },
  { mode: 'stale', label: 'Older than 30 days', help: 'Refresh sources last crawled over a month ago', staleDays: 30 },
  { mode: 'all', label: 'All active sources', help: 'Every active source; can be thousands of jobs', confirm: true },
];

export default function ScraperConsole() {
  const { request } = useAdminSession();
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('sources');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, notify] = useToast();

  // Stats refresh every 20 s while the tab is visible, so worker progress shows without reloading.
  const loadStats = useCallback(() => Promise.all([request('/data-ops/scraper/stats'), request('/data-ops/scraper/runs?limit=5')])
    .then(([nextStats, nextRuns]) => { setStats(nextStats); setRuns(nextRuns.items); setError(''); })
    .catch((failure) => setError(failure.message)), [request]);
  useEffect(() => {
    const first = window.setTimeout(loadStats, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') loadStats(); }, 20_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [loadStats]);
  const refresh = useCallback(() => { loadStats(); setReloadKey((key) => key + 1); }, [loadStats]);

  async function enqueue(body, after) {
    setBusy(body.mode); setConfirmAll(false);
    try {
      const result = await request('/data-ops/scraper/enqueue', { method: 'POST', body });
      notify(result.queued ? `${formatCount(result.queued)} job${result.queued === 1 ? '' : 's'} queued${result.alreadyQueued ? `; ${formatCount(result.alreadyQueued)} already had an open job` : ''}. Start a worker to crawl them.` : `Nothing new to queue (${formatCount(result.selected)} matching source${result.selected === 1 ? '' : 's'}, all already queued).`);
      after?.();
      refresh();
    } catch (failure) { notify(failure.message, 'error'); }
    setBusy('');
  }

  const jobs = stats?.jobs;
  return <div className={styles.page}>
    <div className={styles.notice} role="note">
      <Icon name="guidesClock" />
      <div>
        <p><strong>Crawling runs on the server, not in this browser.</strong> This screen manages crawl sources and the job queue. A worker process leases queued jobs, visits each institution’s official website politely (robots.txt, a few seconds between requests, at most a handful of pages) and saves what it finds as unverified records.</p>
        <code className={styles.code}>npm run scrape --workspace backend -- work{'\n'}npm run scrape --workspace backend -- status</code>
        <p>{stats?.workers?.length ? `${stats.workers.length} worker${stats.workers.length === 1 ? ' is' : 's are'} crawling right now.` : 'No worker is running right now; queued jobs wait until one starts.'}</p>
      </div>
    </div>

    {error && <div className={table.errorBox} role="alert"><Icon name="shield" />{error}</div>}
    <div className={styles.tiles}>
      <div className={styles.tile}><span>Queued</span><strong>{jobs ? formatCount(jobs.queued) : '…'}</strong><small>{stats ? `${formatCount(stats.dueNow)} due now` : ' '}</small></div>
      <div className={styles.tile}><span>Running</span><strong>{jobs ? formatCount(jobs.running) : '…'}</strong><small>Leased by workers</small></div>
      <div className={styles.tile} data-tone="success"><span>Done</span><strong>{jobs ? formatCount(jobs.done) : '…'}</strong><small>Saved to the catalogue</small></div>
      <div className={styles.tile} data-tone="warning"><span>Failed / skipped</span><strong>{jobs ? `${formatCount(jobs.failed)} / ${formatCount(jobs.skipped)}` : '…'}</strong><small>Skipped = robots.txt or not HTML</small></div>
      <div className={styles.tile}><span>Sources</span><strong>{stats ? formatCount(stats.sources.total) : '…'}</strong><small>{stats ? `${formatCount(stats.sources.active)} active · ${formatCount(stats.sources.neverCrawled)} never crawled` : ' '}</small></div>
    </div>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="enqueue-title">
        <div className={styles.cardHeader}><h2 id="enqueue-title">Queue a crawl</h2><button type="button" className={styles.linkButton} onClick={refresh}>Refresh</button></div>
        <p>Creates one job per active source. Sources that already have a queued or running job are left alone. To crawl specific institutions, tick them in the sources table.</p>
        <div className={styles.actions}>{ENQUEUE.map((option) => <button key={option.mode} type="button" className="button button--outline" title={option.help} disabled={Boolean(busy)}
          onClick={() => (option.confirm ? setConfirmAll(true) : enqueue({ mode: option.mode, staleDays: option.staleDays }))}>{busy === option.mode ? 'Queueing…' : option.label}</button>)}</div>
      </section>
      <section className={styles.card} aria-labelledby="runs-title">
        <h2 id="runs-title">Recent runs</h2>
        {!runs.length && <p>No runs yet.</p>}
        <ul className={styles.bars}>{runs.map((run) => <li key={run.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
          <span><strong>{formatDate(run.createdAt)}</strong> · {run.mode} · {run.createdBy}</span>
          <span className={styles.muted}>{formatCount(run.counts.done)} done, {formatCount(run.counts.failed + run.counts.skipped)} failed/skipped, {formatCount(run.counts.queued + run.counts.running)} open</span>
        </li>)}</ul>
      </section>
    </div>

    <div className={styles.segmentedScroll}><div className={table.segmented} role="group" aria-label="Show">
      {[['sources', 'Sources'], ['jobs', 'Jobs']].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}
    </div></div>
    {tab === 'sources'
      ? <SourcesPanel notify={notify} onChanged={loadStats} onEnqueue={enqueue} reloadKey={reloadKey} />
      : <JobsPanel notify={notify} onChanged={loadStats} reloadKey={reloadKey} />}

    <AdminDrawer open={confirmAll} onClose={() => setConfirmAll(false)} title="Queue every active source?" variant="confirm">
      <div className={table.confirm}>
        <p>This queues {stats ? formatCount(stats.sources.active) : 'all'} active sources. With the default politeness settings (8 pages per site, 3 s apart, 4 sites at a time) one worker gets through only a few hundred sites an hour, so tens of thousands of sources take days. Prefer “Never crawled” or “Older than 30 days” for routine refreshes.</p>
        <div className={table.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirmAll(false)}>Cancel</button><button type="button" className="button button--primary" onClick={() => enqueue({ mode: 'all' })}>Queue all</button></div>
      </div>
    </AdminDrawer>
    {toast && <p className={table.toast} data-tone={toast.tone} role="status"><Icon name={toast.tone === 'error' ? 'shield' : 'check'} />{toast.message}</p>}
  </div>;
}
