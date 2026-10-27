'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { useToast } from '@/features/admin/data/useToast';
import { formatCount, formatDate } from '@/features/admin/leads/lead-format';
import { useServerList } from '@/features/admin/table/useServerList';
import rm from '@/features/admin/ResourceManager.module.css';
import { copyText, driveStatusLabel, STATUS_FILTERS } from './drive-format';
import NewDriveDrawer from './NewDriveDrawer';
import styles from './Drives.module.css';

const PAGE_SIZE = 60;
const plural = (count, one, many) => `${formatCount(count)} ${count === 1 ? one : many}`;

// Cards on the current page, grouped State → District (the server sorts newest first).
function groupItems(items) {
  const states = new Map();
  for (const item of items) {
    const state = states.get(item.school.state) ?? { state: item.school.state, districts: new Map() };
    const district = state.districts.get(item.school.district) ?? [];
    district.push(item);
    state.districts.set(item.school.district, district);
    states.set(item.school.state, state);
  }
  return [...states.values()].sort((a, b) => a.state.localeCompare(b.state))
    .map((entry) => ({ state: entry.state, districts: [...entry.districts.entries()].sort(([a], [b]) => a.localeCompare(b)) }));
}

function DriveCard({ item, onCopy }) {
  return <article className={styles.card} data-status={item.status}>
    <div className={styles.cardHead}>
      <span className={styles.pill} data-status={item.status}>{driveStatusLabel(item.status)}</span>
      <small>{formatDate(item.createdAt)}</small>
    </div>
    <h3 className={styles.cardTitle}><Link href={`/admin/drives/${item.id}`}>{item.school.name}</Link></h3>
    <p className={styles.cardMeta}>{[item.school.city !== item.school.district && item.school.city, item.school.district, item.school.state].filter(Boolean).join(', ')}</p>
    {item.campaign && <p className={styles.campaign}>{item.campaign}</p>}
    <div className={styles.cardStats}>
      <strong>{formatCount(item.submissionCount)}</strong>
      <span>{item.submissionCount === 1 ? 'registration' : 'registrations'}{item.maxSubmissions ? ` of ${formatCount(item.maxSubmissions)}` : ''}</span>
    </div>
    <div className={styles.cardActions}>
      <button type="button" className={rm.iconButton} onClick={() => onCopy(item)} aria-label={`Copy link for ${item.school.name}`} title="Copy link"><Icon name="compareLink" /></button>
      <a className={rm.iconButton} href={`/api/admin/drives/${item.id}/qr.png?size=1024&download=1`} aria-label={`Download QR code for ${item.school.name}`} title="Download QR (PNG)"><Icon name="arrowUp" className={styles.down} /></a>
      <Link className="button button--outline" href={`/admin/drives/${item.id}`}>Open<Icon name="arrow" /></Link>
    </div>
  </article>;
}

export default function DrivesManager() {
  const router = useRouter();
  const { admin, request } = useAdminSession();
  const [toast, notify] = useToast();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ q: '', status: 'current', state: '', district: '', page: 1 });
  const [open, setOpen] = useState(() => new Set());
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const list = useServerList(request, '/drives', { ...filters, page: filters.page > 1 ? filters.page : '', status: filters.status === 'current' ? '' : filters.status, limit: PAGE_SIZE }, { scope: admin?.id ?? '' });
  const data = list.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const grouped = useMemo(() => groupItems(items), [items]);
  const groups = data?.groups ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }));
  const toggle = (setter, key) => setter((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  async function copy(item) {
    if (await copyText(item.publicUrl)) notify(`Link copied: ${item.publicUrl}`);
    else notify('Copy failed. Open the drive to copy the link.', 'error');
  }

  const counts = data?.counts;
  const statusCount = (value) => (!counts ? null : value === 'current' ? counts.active + counts.closed : value === 'all' ? counts.active + counts.closed + counts.archived : counts[value]);
  const totalSubmissions = groups.reduce((sum, group) => sum + group.submissions, 0);
  const lastPage = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const folderLabel = filters.district ? `${filters.district}, ${filters.state}` : filters.state;

  const folders = <nav id="drive-folders" className={styles.folders} aria-label="Drives by place">
    <button type="button" className={styles.folderAll} aria-pressed={!filters.state} onClick={() => update({ state: '', district: '' })}>
      <Icon name="map" /><span>All places</span><small>{data ? formatCount(groups.reduce((sum, group) => sum + group.drives, 0)) : ''}</small>
    </button>
    {groups.map((group) => {
      const expanded = open.has(group.state) || filters.state === group.state;
      return <div key={group.state} className={styles.folder}>
        <div className={styles.folderRow}>
          <button type="button" className={styles.folderToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} districts in ${group.state}`} onClick={() => toggle(setOpen, group.state)}><Icon name="chevron" /></button>
          <button type="button" className={styles.folderButton} aria-pressed={filters.state === group.state && !filters.district} onClick={() => update({ state: group.state, district: '' })}>
            <span>{group.state}</span><small>{formatCount(group.drives)}</small>
          </button>
        </div>
        {expanded && <ul className={styles.districts}>{group.districts.map((district) => <li key={district.key}>
          <button type="button" className={styles.folderButton} aria-pressed={filters.state === group.state && filters.district === district.district}
            onClick={() => update({ state: group.state, district: district.district })}>
            <span>{district.district}</span><small title={`${plural(district.submissions, 'registration', 'registrations')}`}>{formatCount(district.drives)}</small>
          </button>
        </li>)}</ul>}
      </div>;
    })}
    {data && !groups.length && <p className={styles.folderEmpty}>Folders appear as you add drives.</p>}
  </nav>;

  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}>
        <span className={styles.summaryIcon}><Icon name="building" /></span>
        <div><strong>School drives</strong><small aria-live="polite">{data ? `${plural(data.total, 'drive', 'drives')}${folderLabel ? ` in ${folderLabel}` : ''} · ${plural(totalSubmissions, 'registration', 'registrations')}` : 'Loading drives…'}</small></div>
      </div>
      <button type="button" className="button button--primary" onClick={() => setCreating(true)}><Icon name="plus" />New drive</button>
    </div>

    <div className={styles.filterBar}>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search drives</span>
        <input type="search" value={query} maxLength={100} placeholder="Search school, district, campaign or code…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className={styles.statusChips} role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((option) => <button key={option.value} type="button" aria-pressed={filters.status === option.value} onClick={() => update({ status: option.value })}>
          {option.label}{statusCount(option.value) !== null && <span>{formatCount(statusCount(option.value))}</span>}
        </button>)}
      </div>
    </div>

    <div className={styles.layout}>
      <aside className={styles.sidebar} data-open={foldersOpen || undefined}>
        {/* Phones: the folder tree folds away behind this button; wider screens always show it. */}
        <button type="button" className={styles.folderSwitch} aria-expanded={foldersOpen} aria-controls="drive-folders" onClick={() => setFoldersOpen((value) => !value)}>
          <Icon name="map" /><span>Browse by place{folderLabel ? `: ${folderLabel}` : ''}</span><Icon name="chevron" />
        </button>
        {folders}
      </aside>

      <section className={styles.results} aria-label="Drives" aria-busy={list.loading || list.busy}>
        {list.error && <div className={styles.errorBox} role="alert"><Icon name="shield" /><p>{list.error}</p><button type="button" className="button button--outline" onClick={list.reload}>Try again</button></div>}
        {list.loading && <div className={styles.skeleton} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>}
        {data && !items.length && !list.error && <div className={styles.empty}>
          <Icon name="building" />
          <p>{filters.q || filters.state || filters.status !== 'current' ? 'No drives match these filters.' : 'No school drives yet. Create one to get a QR code and link for the school.'}</p>
          {filters.q || filters.state || filters.status !== 'current'
            ? <button type="button" className="button button--outline" onClick={() => { setQuery(''); setFilters({ q: '', status: 'current', state: '', district: '', page: 1 }); }}>Clear filters</button>
            : <button type="button" className="button button--primary" onClick={() => setCreating(true)}><Icon name="plus" />New drive</button>}
        </div>}
        {grouped.map((group) => {
          const hidden = collapsed.has(group.state);
          const total = groups.find((entry) => entry.state === group.state);
          return <div key={group.state} className={styles.group} data-busy={list.busy || undefined}>
            <h2 className={styles.groupHead}>
              <button type="button" aria-expanded={!hidden} onClick={() => toggle(setCollapsed, group.state)}>
                <Icon name="chevron" /><span>{group.state || 'No state'}</span>
                {total && <small>{plural(total.drives, 'drive', 'drives')} · {plural(total.submissions, 'registration', 'registrations')}</small>}
              </button>
            </h2>
            {!hidden && group.districts.map(([district, rows]) => <div key={district} className={styles.district}>
              <h3 className={styles.districtHead}><Icon name="location" />{district}<small>{plural(rows.length, 'drive', 'drives')}{data.total > items.length ? ' on this page' : ''}</small></h3>
              <div className={styles.cards}>{rows.map((item) => <DriveCard key={item.id} item={item} onCopy={copy} />)}</div>
            </div>)}
          </div>;
        })}
        {data && data.total > PAGE_SIZE && <nav className={styles.pager} aria-label="Pagination">
          <span>Page {formatCount(filters.page)} of {formatCount(lastPage)}</span>
          <button type="button" className="button button--ghost" disabled={filters.page <= 1 || list.busy} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
          <button type="button" className="button button--ghost" disabled={filters.page >= lastPage || list.busy} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
        </nav>}
      </section>
    </div>

    <NewDriveDrawer open={creating} onClose={() => setCreating(false)} request={request} groups={groups}
      onCreated={(item) => { setCreating(false); list.reload(); router.push(`/admin/drives/${item.id}?tab=builder`); }} />
    {toast && <p className={rm.toast} data-tone={toast.tone} role="status"><Icon name={toast.tone === 'error' ? 'shield' : 'check'} />{toast.message}</p>}
  </div>;
}
