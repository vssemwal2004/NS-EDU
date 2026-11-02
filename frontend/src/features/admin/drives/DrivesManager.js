'use client';
// School drive list: one dense, server-paged table for thousands of schools. Search, state/district/status
// filters and the sort run on the server; "By place" adds State › District headings between the rows.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import RowMenu from '@/features/admin/crm/RowMenu';
import { useToaster } from '@/features/admin/crm/toast';
import { Chip } from '@/features/admin/crm/ui';
import { formatWhen, StatusDot } from '@/features/admin/catalogue/CatalogueParts';
import { formatCount, formatDate, formatDateTime } from '@/features/admin/leads/lead-format';
import Pagination from '@/features/admin/table/Pagination';
import { clearServerListCache, useServerList } from '@/features/admin/table/useServerList';
import { PageToolbar, StatStrip } from '@/features/admin/ui/Page';
import t from '@/features/admin/table/Table.module.css';
import { copyText, driveStatusLabel, qrUrl, SORTS, STATUS_ICONS, STATUS_TONES } from './drive-format';
import NewDriveDrawer from './NewDriveDrawer';
import styles from './Drives.module.css';

const START = { q: '', status: 'current', state: '', district: '', sort: 'place', page: 1, limit: 25 };
const plural = (count, one, many) => `${formatCount(count)} ${count === 1 ? one : many}`;
const sameName = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();
const nameOf = (item) => item.school.name || 'Unnamed school';

/** Drive status: a pill on the drive page header, a dot + word in the list (`dot`). */
export function DriveStatus({ status, closedReason, dot = false }) {
  const title = closedReason === 'limit' ? 'Closed: the registration limit was reached' : undefined;
  if (dot) return <StatusDot tone={STATUS_TONES[status] ?? 'neutral'} title={title}>{driveStatusLabel(status)}</StatusDot>;
  return <Chip tone={STATUS_TONES[status] ?? 'neutral'} icon={STATUS_ICONS[status]} size="sm" title={title}>{driveStatusLabel(status)}</Chip>;
}

/** Status changes shared by the list's row menu and the drive page. Returns the toast message and the undo patch. */
export const STATUS_STEPS = {
  close: { body: { status: 'closed' }, done: 'Registration closed. The link now says “Registration closed”.', undo: 'active' },
  reopen: { body: { status: 'active' }, done: 'Registration reopened.', undo: 'closed' },
  restore: { body: { status: 'closed' }, done: 'Drive restored as closed.', undo: 'archived' },
};

export default function DrivesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(START);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);
  // `?add=1` (the shell's New menu) opens the New drive drawer; closing it removes the parameter.
  const addAsked = searchParams.get('add') === '1';
  const drawerOpen = creating || addAsked;

  const list = useServerList(request, '/drives', {
    q: filters.q, status: filters.status === 'current' ? '' : filters.status, state: filters.state, district: filters.district,
    sort: filters.sort, page: filters.page > 1 ? filters.page : '', limit: filters.limit,
  }, { scope: admin?.id ?? '' });
  const data = list.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const counts = data?.counts;

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const update = (patch) => { setSelected([]); setFilters((current) => ({ ...current, page: 1, ...patch })); };
  const refresh = () => { clearServerListCache('/drives'); list.reload(); };
  const closeDrawer = () => { setCreating(false); if (addAsked) window.history.replaceState(null, '', '/admin/drives'); };
  const filtered = Boolean(filters.q || filters.state || filters.status !== 'current');

  const stateGroup = groups.find((group) => group.state === filters.state);
  const districts = stateGroup?.districts ?? [];
  const inScope = filters.district ? districts.filter((item) => sameName(item.district, filters.district)) : filters.state ? (stateGroup ? [stateGroup] : []) : groups;
  const registrations = inScope.reduce((sum, item) => sum + item.submissions, 0);
  const placeCount = (state, district) => groups.find((group) => group.state === state)?.districts.find((item) => sameName(item.district, district));

  async function copy(item) {
    if (await copyText(item.publicUrl)) toast.success(`Link copied: ${item.publicUrl.replace(/^https?:\/\//, '')}`);
    else toast.error('Copy failed. Open the drive to copy the link.');
  }

  async function patchStatus(item, step) {
    const { body, done, undo } = STATUS_STEPS[step];
    try {
      await request(`/drives/${item.id}`, { method: 'PATCH', body });
      refresh();
      toast.success(done, { action: { label: 'Undo', onClick: () => request(`/drives/${item.id}`, { method: 'PATCH', body: { status: undo } }).then(refresh).catch((failure) => toast.error(failure.message)) } });
    } catch (failure) { toast.error(failure.fields?.status || failure.message); }
  }

  async function runConfirm() {
    const { kind, items: targets } = confirm;
    setWorking(true);
    try {
      if (kind === 'delete') {
        await request(`/drives/${targets[0].id}?permanent=1`, { method: 'DELETE' });
        toast.success(`${nameOf(targets[0])} deleted.`);
      } else if (kind === 'archive' && targets.length === 1) {
        const previous = targets[0].status;
        await request(`/drives/${targets[0].id}`, { method: 'DELETE' });
        toast.success('Drive archived. Its link now says “Registration closed”.', { action: { label: 'Undo', onClick: () => request(`/drives/${targets[0].id}`, { method: 'PATCH', body: { status: previous } }).then(refresh).catch((failure) => toast.error(failure.message)) } });
      } else {
        const result = await request('/drives/bulk', { method: 'POST', body: { action: kind, ids: targets.map((item) => item.id) } });
        const verb = { close: 'closed', archive: 'archived', restore: 'restored' }[kind];
        toast.success(`${plural(result.updated, 'drive', 'drives')} ${verb}${result.skipped ? ` · ${formatCount(result.skipped)} already ${verb} or not applicable` : ''}.`);
        setSelected([]);
      }
      setConfirm(null);
      refresh();
    } catch (failure) {
      setConfirm((current) => current && { ...current, error: failure.message });
    } finally { setWorking(false); }
  }

  const menuFor = (item) => [
    { key: 'open', label: 'Open form builder', icon: 'edit', href: `/admin/drives/${item.id}` },
    { key: 'qr', label: 'QR & link', icon: 'link', href: `/admin/drives/${item.id}?tab=qr` },
    { key: 'registrations', label: 'Registrations', icon: 'people', href: `/admin/drives/${item.id}?tab=submissions`, hint: formatCount(item.submissionCount) },
    { key: 'settings', label: 'Settings', icon: 'settings', href: `/admin/drives/${item.id}?tab=settings` },
    { divider: true },
    { key: 'copy', label: 'Copy link', icon: 'copy', onSelect: () => copy(item) },
    { key: 'download', label: 'Download QR (PNG)', icon: 'download', onSelect: () => window.location.assign(qrUrl(item.id)) },
    { key: 'poster', label: 'Print poster', icon: 'printer', onSelect: () => window.open(`/admin/drives/${item.id}/poster`, '_blank', 'noopener') },
    { divider: true },
    { key: 'close', label: 'Close registration', icon: 'lock', hidden: item.status !== 'active', onSelect: () => patchStatus(item, 'close') },
    { key: 'reopen', label: 'Reopen registration', icon: 'refresh', hidden: item.status !== 'closed', onSelect: () => patchStatus(item, 'reopen') },
    { key: 'restore', label: 'Restore drive', icon: 'undo', hidden: item.status !== 'archived', onSelect: () => patchStatus(item, 'restore') },
    { key: 'archive', label: 'Archive…', icon: 'archive', hidden: item.status === 'archived', onSelect: () => setConfirm({ kind: 'archive', items: [item] }) },
    { key: 'delete', label: 'Delete permanently…', icon: 'trash', tone: 'danger', disabled: item.submissionCount > 0, reason: 'Drives with registrations can only be archived', onSelect: () => setConfirm({ kind: 'delete', items: [item] }) },
  ];

  const byPlace = filters.sort === 'place';
  const columnCount = byPlace ? 7 : 8;
  const ids = items.map((item) => item.id);
  const allChosen = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someChosen = ids.some((id) => selected.includes(id));
  const chosenItems = items.filter((item) => selected.includes(item.id));
  const openRow = (event, item) => { if (!event.target.closest('a, button, input, label, [role="menu"]')) router.push(`/admin/drives/${item.id}`); };

  const rows = [];
  let lastPlace = '';
  for (const item of items) {
    const place = `${item.school.state}|${item.school.district.toLowerCase()}`;
    if (byPlace && place !== lastPlace) {
      const total = placeCount(item.school.state, item.school.district);
      rows.push(<tr key={`place-${place}`} className={styles.groupRow}><th scope="rowgroup" colSpan={columnCount}>
        <span><Icon name="location" />{item.school.state || 'No state'}<span aria-hidden="true">›</span>{item.school.district || 'No district'}</span>
        {total && <small>{plural(total.drives, 'drive', 'drives')} · {plural(total.submissions, 'registration', 'registrations')}</small>}
      </th></tr>);
      lastPlace = place;
    }
    const sub = [item.school.city && !sameName(item.school.city, item.school.district) && item.school.city, item.campaign].filter(Boolean).join(' · ');
    rows.push(<tr key={item.id} className={styles.clickRow} data-selected={selected.includes(item.id) || undefined} onClick={(event) => openRow(event, item)}>
      <td className={t.checkCell}><input type="checkbox" aria-label={`Select ${nameOf(item)}`} checked={selected.includes(item.id)}
        onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))} /></td>
      <td className={styles.mainCell}><div className={styles.oneLine}><Link href={`/admin/drives/${item.id}`} className={styles.rowLink} title={nameOf(item)}>{nameOf(item)}</Link>{sub && <small title={sub}>{sub}</small>}</div></td>
      {!byPlace && <td data-label="Place" className={styles.optional}><span className={styles.clip} title={`${item.school.district}, ${item.school.state}`}>{item.school.district}<span className={styles.muted}>, {item.school.state}</span></span></td>}
      <td data-label="Status"><DriveStatus status={item.status} closedReason={item.closedReason} dot /></td>
      <td data-label="Registrations" className={styles.num}><span className="crm-tabnum">{formatCount(item.submissionCount)}</span>{item.maxSubmissions ? <small className="crm-tabnum">of {formatCount(item.maxSubmissions)}</small> : null}</td>
      <td data-label="Last registration" className={styles.optional} title={item.lastSubmissionAt ? formatDateTime(item.lastSubmissionAt) : undefined}>{item.lastSubmissionAt ? formatWhen(item.lastSubmissionAt) : <span className={styles.muted}>—</span>}</td>
      <td data-label="Created" className={styles.optional}>{formatDate(item.createdAt)}</td>
      <td className={styles.menuCell}><RowMenu label={`Actions for ${nameOf(item)}`} items={menuFor(item)} /></td>
    </tr>);
  }

  const statusItem = (key, label, value, icon, tone) => ({ key, label, value: value ?? 0, icon, tone, active: filters.status === key, onClick: () => update({ status: filters.status === key && key !== 'current' ? 'current' : key }) });
  const scopeLabel = filters.district ? `${filters.district}, ${filters.state}` : filters.state;

  return <div className={styles.screen}>
    <PageToolbar start={<>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search drives</span>
        <input type="search" value={query} maxLength={100} placeholder="School, district, campaign or code" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className={styles.inlineSelect}><span className="sr-only">State</span>
        <select className="adm-select" value={filters.state} onChange={(event) => update({ state: event.target.value, district: '' })}>
          <option value="">All states</option>
          {groups.map((group) => <option key={group.state} value={group.state}>{group.state} ({formatCount(group.drives)})</option>)}
          {filters.state && !stateGroup && <option value={filters.state}>{filters.state}</option>}
        </select>
      </label>
      <label className={styles.inlineSelect}><span className="sr-only">District</span>
        <select className="adm-select" value={filters.district} disabled={!filters.state} title={filters.state ? undefined : 'Choose a state first'} onChange={(event) => update({ district: event.target.value })}>
          <option value="">{filters.state ? 'All districts' : 'District'}</option>
          {districts.map((item) => <option key={item.key} value={item.district}>{item.district} ({formatCount(item.drives)})</option>)}
        </select>
      </label>
      <label className={styles.inlineSelect}><span className="sr-only">Sort</span>
        <select className="adm-select" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
          {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {filtered && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { setQuery(''); update({ ...START, sort: filters.sort, limit: filters.limit }); }}>Clear</button>}
    </>}>
      <button type="button" className="adm-btn adm-btn--primary" onClick={() => setCreating(true)}><Icon name="plus" />New drive</button>
    </PageToolbar>

    <StatStrip loading={!counts} label="Drives by status" items={[
      statusItem('current', 'Open & closed', counts && counts.active + counts.closed, 'building', 'neutral'),
      statusItem('active', 'Open', counts?.active, 'checkCircle', 'good'),
      statusItem('closed', 'Closed', counts?.closed, 'lock', 'warn'),
      statusItem('archived', 'Archived', counts?.archived, 'archive', 'neutral'),
      { key: 'registrations', label: `Registrations${scopeLabel ? ` in ${scopeLabel}` : ''}`, value: registrations, icon: 'people', tone: 'info' },
    ]} />

    <section className={`adm-panel ${styles.tablePanel}`} aria-label="School drives">
      {selected.length > 0 && <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
        <strong>{plural(selected.length, 'drive', 'drives')} selected</strong>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => setConfirm({ kind: 'close', items: chosenItems })}><Icon name="lock" />Close registration</button>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => setConfirm({ kind: 'archive', items: chosenItems })}><Icon name="archive" />Archive</button>
        {chosenItems.some((item) => item.status === 'archived') && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setConfirm({ kind: 'restore', items: chosenItems })}><Icon name="undo" />Restore</button>}
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSelected([])}>Clear selection</button>
      </div>}
      {list.error ? <div className={t.state} role="alert"><Icon name="alert" /><p>{list.error}</p><button type="button" className="adm-btn adm-btn--sm" onClick={list.reload}>Try again</button></div>
        : <div className={t.scroll} data-busy={list.busy || undefined}>
          <table className={`${t.table} ${styles.table}`} aria-busy={list.loading || list.busy}>
            <caption className="sr-only">School drives{scopeLabel ? ` in ${scopeLabel}` : ''}</caption>
            <thead><tr>
              <th scope="col" className={t.checkCell}><input type="checkbox" aria-label="Select all drives on this page" checked={allChosen} disabled={!ids.length}
                ref={(node) => { if (node) node.indeterminate = someChosen && !allChosen; }}
                onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} /></th>
              <th scope="col">School</th>
              {!byPlace && <th scope="col" className={styles.optional} style={{ width: '17%' }}>Place</th>}
              <th scope="col" style={{ width: 104 }}>Status</th>
              <th scope="col" className={styles.num} style={{ width: 110 }}>Registrations</th>
              <th scope="col" className={styles.optional} style={{ width: 130 }}>Last registration</th>
              <th scope="col" className={styles.optional} style={{ width: 110 }}>Created</th>
              <th scope="col" className={styles.menuCell}><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              {list.loading && !items.length ? Array.from({ length: 10 }, (_, index) => <tr key={index} className={t.skeletonRow} aria-hidden="true">
                {Array.from({ length: columnCount }, (_, cell) => <td key={cell} className={cell === 0 ? t.checkCell : undefined}><span style={{ width: cell === 1 ? '60%' : '70%' }} /></td>)}
              </tr>) : rows}
            </tbody>
          </table>
          {data && !items.length && <div className={styles.emptyLine}>
            {filtered ? <><span>No drives match these filters.</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); update({ ...START, sort: filters.sort, limit: filters.limit }); }}>Clear filters</button></>
              : <><span title="A drive gives a school its own registration form, link and QR code.">No school drives yet.</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => setCreating(true)}><Icon name="plus" />New drive</button></>}
          </div>}
        </div>}
      {data && data.total > 0 && <Pagination page={filters.page} pageSize={filters.limit} total={data.total} rowCount={items.length} noun="drives"
        hasNext={filters.page * filters.limit < data.total} hasPrevious={filters.page > 1} disabled={list.busy}
        onPage={(page) => { setSelected([]); setFilters((current) => ({ ...current, page })); }} onPageSize={(limit) => update({ limit })} />}
    </section>

    <NewDriveDrawer open={drawerOpen} onClose={closeDrawer} request={request} groups={groups}
      onCreated={(item) => { closeDrawer(); refresh(); toast.success(`${nameOf(item)} created. Add your questions, then print the QR code.`); router.push(`/admin/drives/${item.id}`); }} />

    <ConfirmDialog open={Boolean(confirm)} busy={working} error={confirm?.error} tone={confirm?.kind === 'delete' || confirm?.kind === 'archive' ? 'danger' : 'primary'}
      requireText={confirm?.kind === 'delete' ? 'DELETE' : undefined}
      icon={confirm?.kind === 'close' ? 'lock' : confirm?.kind === 'restore' ? 'undo' : undefined}
      title={!confirm ? '' : confirm.kind === 'delete' ? `Delete ${nameOf(confirm.items[0])}?`
        : confirm.items.length === 1 ? `${{ archive: 'Archive', close: 'Close registration for', restore: 'Restore' }[confirm.kind]} ${nameOf(confirm.items[0])}?`
          : `${{ archive: 'Archive', close: 'Close registration for', restore: 'Restore' }[confirm.kind]} ${plural(confirm.items.length, 'drive', 'drives')}?`}
      confirmLabel={!confirm ? '' : { delete: 'Delete drive', archive: 'Archive', close: 'Close registration', restore: 'Restore' }[confirm.kind]}
      onConfirm={runConfirm} onCancel={() => setConfirm(null)}>
      {confirm?.kind === 'delete' && 'The drive has no registrations. Its form, link and QR code are removed for good; printed posters stop working.'}
      {confirm?.kind === 'archive' && 'The link and QR code will show “Registration closed” and the drive leaves this list. Registrations stay in Leads, and you can restore it later.'}
      {confirm?.kind === 'close' && 'Students who scan the QR code will see “Registration closed”. You can reopen each drive from its menu.'}
      {confirm?.kind === 'restore' && 'Archived drives come back to the list as closed. Reopen them one by one when you visit the school again.'}
    </ConfirmDialog>
  </div>;
}
