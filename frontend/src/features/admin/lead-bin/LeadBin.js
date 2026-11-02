'use client';
/**
 * Lead bin: deleted leads that can still be restored. Needs leads.delete and company-wide lead scope (the API enforces both).
 * Data: GET /crm/trash?page · POST /crm/trash/:id/restore · DELETE /crm/trash/:id (owners only, removes notes and follow-ups too).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import RowMenu from '@/features/admin/crm/RowMenu';
import { useToaster } from '@/features/admin/crm/toast';
import { CHANNELS } from '@/features/admin/crm/meta';
import { dateTimeOf, displayName, formatNumber } from '@/features/admin/crm/format';
import { Dash, formatWhen, Person } from '@/features/admin/leads/lead-bits';
import DataTable from '@/features/admin/table/DataTable';
import Pagination from '@/features/admin/table/Pagination';
import { PageToolbar } from '@/features/admin/ui/Page';
import styles from './LeadBin.module.css';

const COLUMNS = [
  { key: 'lead', label: 'Lead' },
  { key: 'channel', label: 'Source', width: 170 },
  { key: 'deleted', label: 'Deleted', width: 150 },
  { key: 'by', label: 'Deleted by', width: 180 },
  { key: 'actions', label: 'Actions', width: 130 },
];

export default function LeadBin() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: '', data: null, error: '', status: 0 });
  const [busyId, setBusyId] = useState('');
  const [purging, setPurging] = useState(null);
  const key = `${page}|${size}|${version}`;
  const owner = Boolean(admin?.isOwner);

  useEffect(() => {
    const controller = new AbortController();
    request(`/crm/trash?page=${page}&limit=${size}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || !data) return;
        // The last row of the last page was just restored or deleted: step back one page.
        if (data.items.length === 0 && page > 1) { setPage(page - 1); return; }
        setState({ key, data, error: '', status: 200 });
      })
      .catch((failure) => { if (!controller.signal.aborted && failure.name !== 'AbortError') setState({ key, data: null, error: failure.message || 'Could not load the bin.', status: failure.status ?? 0 }); });
    return () => controller.abort();
  }, [key, page, size, request]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const loading = state.key !== key && !state.data && !state.error;
  const busy = state.key !== key && Boolean(state.data);
  const data = state.data;
  const limit = data?.limit ?? size;
  const forbidden = state.status === 403;

  async function restore(item) {
    setBusyId(item.id);
    try {
      await request(`/crm/trash/${item.id}/restore`, { method: 'POST' });
      toast.success(`${item.name || 'Lead'} restored`, { action: { label: 'Open lead', onClick: () => router.push(`/admin/leads/${item.id}`) } });
      reload();
    } catch (failure) { toast.error(`Could not restore: ${failure.message}`); } finally { setBusyId(''); }
  }
  async function purge() {
    const { item } = purging;
    setPurging({ item, busy: true, error: '' });
    try {
      await request(`/crm/trash/${item.id}`, { method: 'DELETE' });
      setPurging(null);
      toast.success(`${item.name || 'Lead'} deleted forever`);
      reload();
    } catch (failure) { setPurging({ item, busy: false, error: failure.message }); }
  }

  function renderCell(item, column) {
    switch (column.key) {
      case 'lead': return <div className={styles.two}><strong title={item.name}>{item.name || 'Unnamed lead'}</strong><small className="crm-tabnum">{[item.phone, item.ref].filter(Boolean).join(' · ')}</small></div>;
      case 'channel': return <span className={styles.truncate}>{CHANNELS[item.channel || 'web-apply']?.label ?? item.channel}</span>;
      case 'deleted': return item.deletedAt ? <span className="crm-tabnum" title={dateTimeOf(item.deletedAt)}>{formatWhen(item.deletedAt)}</span> : <Dash />;
      case 'by': return item.deletedBy ? <Person name={displayName(item.deletedBy)} email={item.deletedBy} title={item.deletedBy} /> : <Dash title="Not recorded" />;
      case 'actions': return <div className={styles.actions}>
        <button type="button" className="adm-btn adm-btn--sm" disabled={busyId === item.id} onClick={() => restore(item)}><Icon name="undo" />{busyId === item.id ? 'Restoring…' : 'Restore'}</button>
        <RowMenu label={`Actions for ${item.name || item.ref}`} items={[
          { key: 'restore', label: 'Restore lead', icon: 'undo', onSelect: () => restore(item) },
          { divider: true },
          { key: 'purge', label: 'Delete forever…', icon: 'trash', tone: 'danger', disabled: !owner, reason: 'Only an owner can delete a lead forever', onSelect: () => setPurging({ item, busy: false, error: '' }) },
        ]} />
      </div>;
      default: return null;
    }
  }

  const summary = forbidden ? 'The bin is limited to roles that see every lead.'
    : data ? <span title={`Restored leads come back with their notes and follow-ups.${owner ? '' : ' Only an owner can delete forever.'}`}><strong>{formatNumber(data.total)}</strong> deleted {data.total === 1 ? 'lead' : 'leads'}</span> : 'Loading…';

  return <div className={styles.page}>
    <PageToolbar summary={summary}>
      <button type="button" className="adm-btn adm-btn--icon" onClick={reload} aria-label="Refresh the bin" title="Refresh" disabled={loading}><Icon name="refresh" /></button>
    </PageToolbar>

    {forbidden ? <div className={`adm-panel ${styles.note}`}><Icon name="lock" /><p>Your role can delete leads it can see, but restoring them needs company-wide lead access. Ask an owner or an analyst to restore a lead for you.</p></div>
      : <section className={`adm-panel ${styles.tableCard}`} aria-label="Deleted leads">
        <DataTable columns={COLUMNS} rows={data?.items ?? []} loading={loading} busy={busy} pageSize={10} caption="Deleted leads, newest first"
          error={state.error} onRetry={reload} renderCell={renderCell} rowLabel={(item) => item.ref}
          empty={<p>The bin is empty</p>} />
        {data && data.items.length > 0 && <Pagination page={data.page ?? page} pageSize={limit} pageSizes={[25, 50, 100]} total={data.total} rowCount={data.items.length}
          hasNext={(data.page ?? page) * limit < data.total} hasPrevious={page > 1} disabled={busy} noun="deleted leads"
          onPage={setPage} onPageSize={(value) => { setSize(value); setPage(1); }} onNext={() => setPage(page + 1)} onPrevious={() => setPage(Math.max(1, page - 1))} />}
      </section>}

    <ConfirmDialog open={Boolean(purging)} tone="danger" icon="trash" title={purging ? `Delete ${purging.item.name || purging.item.ref} forever?` : ''} confirmLabel="Delete forever" requireText="DELETE" busy={purging?.busy} error={purging?.error}
      onCancel={() => setPurging(null)} onConfirm={purge}>
      <p>This permanently removes the lead <strong>and all of its notes, call logs and follow-ups</strong>. It cannot be restored afterwards, and it will not appear in any report.</p>
    </ConfirmDialog>
  </div>;
}
