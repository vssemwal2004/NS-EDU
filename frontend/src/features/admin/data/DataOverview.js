'use client';
// Data pipeline › Overview: review backlog, profile coverage, where records come from, scraper status, exports.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { PageToolbar, Panel, StatStrip } from '../ui/Page';
import BarList from '../ui/BarList';
import { ErrorState, Facts, FormSkeleton } from '../catalogue/CatalogueParts';
import { exportUrl, formatCount, formatDate } from './data-api';
import { JOB_ORDER, JOB_STATUS } from './data-ui';
import styles from '../catalogue/Catalogue.module.css';

const SOURCE_LABELS = { seed: 'Seed data', admin: 'Admin console', import: 'File import', scrape: 'Official websites', unknown: 'Unknown' };
const COVERAGE = [
  ['about', 'Description'], ['photos', 'Campus photos'], ['programmes', 'Programme list'], ['courses', 'Linked to catalogue courses'],
  ['fees', 'Published fees'], ['placements', 'Placement figures'], ['placementSeasons', 'Two or more placement seasons'],
];
const EXPORTS = [['All universities', {}], ['Verified', { verification: 'verified' }], ['Awaiting review', { verification: 'unverified' }], ['Scraped', { 'source.kind': 'scrape' }]];

export default function DataOverview() {
  const { request } = useAdminSession();
  const [state, setState] = useState({ data: null, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request('/data-ops/overview', { signal: controller.signal })
      .then((data) => setState({ data, error: '' }))
      .catch((failure) => { if (failure.name !== 'AbortError') setState({ data: null, error: failure.message }); });
    return () => controller.abort();
  }, [request, attempt]);
  const retry = useCallback(() => { setState({ data: null, error: '' }); setAttempt((value) => value + 1); }, []);

  const data = state.data;
  const institutions = data?.institutions;
  const scraper = data?.scraper;
  const total = institutions?.total ?? 0;
  const workers = scraper?.workers?.length ?? 0;

  return <div className={styles.screen}>
    <PageToolbar>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon" onClick={retry} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
      <Link className="adm-btn" href="/admin/data/review"><Icon name="collegesCheckCircle" />Review queue</Link>
      <Link className="adm-btn adm-btn--primary" href="/admin/data/import"><Icon name="upload" />Import a file</Link>
    </PageToolbar>

    {state.error ? <div className={styles.card}><ErrorState message={state.error} onRetry={retry} /></div> : <>
      <StatStrip label="Review backlog" loading={!data} items={[
        { key: 'total', label: 'Universities', value: total, icon: 'building' },
        { key: 'verified', label: 'Verified', value: institutions?.verified ?? 0, icon: 'checkCircle', tone: 'good' },
        { key: 'held', label: 'Held for review', value: institutions?.held ?? 0, icon: 'clock', tone: 'warn', href: '/admin/data/review?view=held' },
        { key: 'visible', label: 'Visible, unverified', value: Math.max(0, (institutions?.unverified ?? 0) - (institutions?.held ?? 0)), icon: 'eye', tone: 'info', href: '/admin/data/review?view=visible' },
        { key: 'rejected', label: 'Rejected', value: institutions?.rejected ?? 0, icon: 'ban', tone: 'bad' },
        { key: 'hidden', label: 'Hidden', value: institutions?.hidden ?? 0, icon: 'eyeOff' },
      ]} />

      <div className={styles.grid}>
        <Panel title="Profile coverage" description="Records that carry each kind of content. The crawler fills these from official websites.">
          {data ? <BarList label="Profile coverage" unit="universities" total={total} rows={COVERAGE.map(([key, label]) => ({ key, label, value: data.coverage?.[key] ?? 0 }))} /> : <FormSkeleton rows={4} />}
        </Panel>
        <Panel title="Where records come from">
          {data ? <BarList label="Record sources" unit="universities" total={total} emptyText="No universities yet. Import a file or queue a crawl."
            rows={Object.entries(institutions.bySource ?? {}).sort((a, b) => b[1] - a[1]).map(([kind, value]) => ({ key: kind, label: SOURCE_LABELS[kind] ?? kind, value, href: kind === 'unknown' ? undefined : `/admin/institutions?source.kind=${kind}` }))} /> : <FormSkeleton rows={3} />}
        </Panel>
        <Panel title="Crawler queue" meta={data ? `${formatCount(scraper.sources.total)} sources · ${formatCount(scraper.sources.neverCrawled)} never crawled` : undefined}
          actions={<Link className="adm-btn adm-btn--sm" href="/admin/data/scraper">Open scraper</Link>}>
          {data ? <>
            <dl className={styles.queueGrid}>{JOB_ORDER.map((status) => <div key={status}><dt>{JOB_STATUS[status][1]}</dt><dd data-tone={status === 'failed' && scraper.jobs[status] ? 'bad' : undefined}>{formatCount(scraper.jobs[status])}</dd></div>)}</dl>
            <Facts className={styles.panelFacts} rows={[
              ['Workers', workers ? `${workers} running` : <span title="Queued jobs wait until a worker starts on the server.">None running</span>],
              scraper.lastRun && ['Last run', <span key="run" title={`by ${scraper.lastRun.createdBy}`}>{formatDate(scraper.lastRun.createdAt)} · {formatCount(scraper.lastRun.counts.done)} done · {formatCount(scraper.lastRun.counts.failed)} failed · {formatCount(scraper.lastRun.counts.queued + scraper.lastRun.counts.running)} open</span>],
            ]} />
          </> : <FormSkeleton rows={2} />}
        </Panel>
        <Panel title="Export" description="CSV in UTF-8 (opens in Excel or Sheets). Edit and import it again; rows match on slug.">
          <div className={styles.exportLinks}>{EXPORTS.map(([label, params]) => <a key={label} className="adm-btn adm-btn--sm" href={exportUrl(params)} download><Icon name="download" />{label}</a>)}</div>
        </Panel>
      </div>
    </>}
  </div>;
}
