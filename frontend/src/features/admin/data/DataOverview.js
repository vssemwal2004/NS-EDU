'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { exportUrl, formatCount, formatDate } from './data-api';
import styles from './DataOps.module.css';
import table from '../ResourceManager.module.css';

const SOURCE_LABELS = { seed: 'Seed data', admin: 'Admin console', import: 'File import', scrape: 'Official websites', unknown: 'Unknown' };
const JOB_ORDER = ['queued', 'running', 'done', 'failed', 'skipped', 'cancelled'];

export default function DataOverview() {
  const { request } = useAdminSession();
  const [state, setState] = useState({ data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    request('/data-ops/overview', { signal: controller.signal })
      .then((data) => setState({ data, error: '' }))
      .catch((failure) => { if (failure.name !== 'AbortError') setState({ data: null, error: failure.message }); });
    return () => controller.abort();
  }, [request]);

  if (state.error) return <div className={table.errorBox} role="alert"><Icon name="shield" />{state.error}</div>;
  const data = state.data;
  const institutions = data?.institutions;
  const scraper = data?.scraper;
  const sources = Object.entries(institutions?.bySource ?? {}).sort((a, b) => b[1] - a[1]);
  const largest = Math.max(1, ...sources.map(([, count]) => count));

  return <div className={styles.page} aria-busy={!data}>
    <div className={styles.intro}>
      <p>Universities arrive from file imports and from the official-website scraper. New records stay <strong>unverified</strong> until an administrator checks them; records missing a state or official website are held back from students.</p>
      <div className={styles.actions}>
        <Link className="button button--primary" href="/admin/data/import"><Icon name="document" />Import a file</Link>
        <Link className="button button--outline" href="/admin/data/review"><Icon name="collegesCheckCircle" />Review queue</Link>
      </div>
    </div>

    <div className={styles.tiles}>
      <div className={styles.tile}><span>Universities</span><strong>{data ? formatCount(institutions.total) : '…'}</strong><small>All records, including hidden</small></div>
      <div className={styles.tile} data-tone="success"><span>Verified</span><strong>{data ? formatCount(institutions.verified) : '…'}</strong><small>Checked by an administrator</small></div>
      <Link className={styles.tile} href="/admin/data/review?view=held" data-tone="warning"><span>Held for review</span><strong>{data ? formatCount(institutions.held) : '…'}</strong><small>Unverified and hidden from students</small></Link>
      <Link className={styles.tile} href="/admin/data/review?view=visible"><span>Visible, unverified</span><strong>{data ? formatCount(Math.max(0, institutions.unverified - institutions.held)) : '…'}</strong><small>Shown with their source until verified</small></Link>
    </div>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="sources-title">
        <h2 id="sources-title">Where records come from</h2>
        {data && !sources.length && <p>No universities yet. Import a file or run the scraper.</p>}
        <ul className={styles.bars}>{sources.map(([kind, count]) => <li key={kind}>
          <span>{SOURCE_LABELS[kind] ?? kind}</span><span aria-hidden="true"><i style={{ width: `${(count / largest) * 100}%` }} /></span><strong>{formatCount(count)}</strong>
        </li>)}</ul>
        {data && <p>{formatCount(institutions.rejected)} rejected · {formatCount(institutions.hidden)} hidden in total</p>}
      </section>

      <section className={styles.card} aria-labelledby="scraper-title">
        <div className={styles.cardHeader}><h2 id="scraper-title">Scraper queue</h2><Link className={styles.linkButton} href="/admin/data/scraper">Open scraper</Link></div>
        <div className={styles.statusList}>{JOB_ORDER.map((status) => <span key={status} className={styles.pill} data-status={status}>{status} {data ? formatCount(scraper.jobs[status]) : '…'}</span>)}</div>
        {data && <p>{formatCount(scraper.sources.total)} crawl sources ({formatCount(scraper.sources.neverCrawled)} never crawled). {scraper.workers.length ? `${scraper.workers.length} worker${scraper.workers.length === 1 ? '' : 's'} running.` : 'No worker is running right now.'}</p>}
        {scraper?.lastRun && <p>Last run {formatDate(scraper.lastRun.createdAt)} by {scraper.lastRun.createdBy}: {formatCount(scraper.lastRun.counts.done)} done, {formatCount(scraper.lastRun.counts.failed)} failed, {formatCount(scraper.lastRun.counts.queued + scraper.lastRun.counts.running)} still open.</p>}
      </section>

      <section className={styles.card} aria-labelledby="export-title">
        <h2 id="export-title">Export</h2>
        <p>Download records as CSV (UTF-8, opens in Excel or Sheets). The file can be edited and imported again; rows match on slug.</p>
        <div className={styles.actions}>
          <a className={styles.linkButton} href={exportUrl()} download>All universities</a>
          <a className={styles.linkButton} href={exportUrl({ verification: 'verified' })} download>Verified only</a>
          <a className={styles.linkButton} href={exportUrl({ verification: 'unverified' })} download>Awaiting review</a>
          <a className={styles.linkButton} href={exportUrl({ 'source.kind': 'scrape' })} download>Scraped</a>
        </div>
      </section>
    </div>
  </div>;
}
