'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import RowMenu from '@/features/admin/crm/RowMenu';
import { useToaster } from '@/features/admin/crm/toast';
import LeadsManager from '@/features/admin/leads/LeadsManager';
import { formatCount } from '@/features/admin/leads/lead-format';
import { clearServerListCache } from '@/features/admin/table/useServerList';
import { PageToolbar, ViewTabs } from '@/features/admin/ui/Page';
import { copyText, qrUrl } from './drive-format';
import { DriveStatus, STATUS_STEPS } from './DrivesManager';
import DriveQrPanel from './DriveQrPanel';
import DriveSettings from './DriveSettings';
import FormBuilder from './FormBuilder';
import { keepGuardState, useUnsavedGuard } from './useUnsavedGuard';
import styles from './Drives.module.css';

const TABS = ['builder', 'qr', 'submissions', 'settings'];
const DISCARD = 'The form has unsaved changes. Discard them?';

export default function DriveDetail({ id, initialTab = 'builder' }) {
  const router = useRouter();
  const { request } = useAdminSession();
  const toast = useToaster();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'builder');
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);
  useUnsavedGuard(dirty, DISCARD);
  // The drive list caches pages briefly; a saved change must show there on the way back.
  const saved = (next) => { setItem(next); clearServerListCache('/drives'); };

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(`/drives/${id}`, { signal: controller.signal }).then(({ item: loaded }) => { setItem(loaded); setError(''); }).catch((failure) => {
      if (failure.name !== 'AbortError') setError(failure.status === 404 ? 'This school drive does not exist or was deleted.' : failure.message);
    });
    return () => controller.abort();
  }, [id, request, attempt]);

  function choose(next) {
    if (next === tab) return;
    if (dirty && tab === 'builder' && !window.confirm(DISCARD)) return;
    if (tab === 'builder') setDirty(false);
    setTab(next);
    window.history.replaceState(keepGuardState(), '', `/admin/drives/${id}${next === 'builder' ? '' : `?tab=${next}`}`);
  }

  if (error) return <div className={`adm-panel ${styles.pageState}`} role="alert">
    <Icon name="alert" /><span><strong>Could not open this drive.</strong> {error}</span>
    <Link className="adm-btn adm-btn--sm" href="/admin/drives">All drives</Link>
    <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Try again</button>
  </div>;
  if (!item) return <div className={styles.detailSkeleton} aria-busy="true" aria-label="Loading the drive"><span /><span /><span /></div>;

  async function copy() {
    if (await copyText(item.publicUrl)) toast.success('Link copied.');
    else toast.error('Copy failed. Open the QR & link tab to copy it.');
  }
  async function step(name) {
    const { body, done, undo } = STATUS_STEPS[name];
    try {
      const { item: next } = await request(`/drives/${item.id}`, { method: 'PATCH', body });
      saved(next);
      toast.success(done, { action: { label: 'Undo', onClick: () => request(`/drives/${item.id}`, { method: 'PATCH', body: { status: undo } }).then(({ item: back }) => saved(back)).catch((failure) => toast.error(failure.message)) } });
    } catch (failure) { toast.error(failure.fields?.status || failure.message); }
  }
  async function remove() {
    setWorking(true);
    try {
      if (confirm === 'delete') {
        await request(`/drives/${item.id}?permanent=1`, { method: 'DELETE' });
        clearServerListCache('/drives');
        toast.success(`${item.school.name} deleted.`);
        router.push('/admin/drives');
        return;
      }
      const previous = item.status;
      const result = await request(`/drives/${item.id}`, { method: 'DELETE' });
      saved(result.item);
      setConfirm(null);
      toast.success('Drive archived. Its link now says “Registration closed”.', { action: { label: 'Undo', onClick: () => request(`/drives/${item.id}`, { method: 'PATCH', body: { status: previous } }).then(({ item: back }) => saved(back)).catch((failure) => toast.error(failure.message)) } });
    } catch (failure) {
      setConfirm((current) => current && { kind: current.kind ?? current, error: failure.message });
    } finally { setWorking(false); }
  }

  const kind = confirm?.kind ?? confirm;
  const place = [item.school.city && item.school.city.toLowerCase() !== item.school.district.toLowerCase() && item.school.city, item.school.district, item.school.state].filter(Boolean).join(', ');
  const more = [
    { key: 'poster', label: 'Print poster', icon: 'printer', onSelect: () => window.open(`/admin/drives/${item.id}/poster`, '_blank', 'noopener') },
    { key: 'download', label: 'Download QR (PNG)', icon: 'download', onSelect: () => window.location.assign(qrUrl(item.id)) },
    { divider: true },
    { key: 'close', label: 'Close registration', icon: 'lock', hidden: item.status !== 'active', onSelect: () => step('close') },
    { key: 'reopen', label: 'Reopen registration', icon: 'refresh', hidden: item.status !== 'closed', onSelect: () => step('reopen') },
    { key: 'restore', label: 'Restore drive', icon: 'undo', hidden: item.status !== 'archived', onSelect: () => step('restore') },
    { key: 'archive', label: 'Archive…', icon: 'archive', hidden: item.status === 'archived', onSelect: () => setConfirm('archive') },
    { key: 'delete', label: 'Delete permanently…', icon: 'trash', tone: 'danger', disabled: item.submissionCount > 0, reason: 'Drives with registrations can only be archived', onSelect: () => setConfirm('delete') },
  ];

  return <div className={styles.screen}>
    <PageToolbar start={<div className={styles.detailHead}>
      <Link href="/admin/drives" className={styles.back} aria-label="All school drives" title="All school drives"><Icon name="arrow" /></Link>
      <div className={styles.detailTitle}>
        <p><strong title={item.school.name}>{item.school.name}</strong><DriveStatus status={item.status} closedReason={item.closedReason} /></p>
        <small><span title={place}>{place}</span><span className={styles.code}>/r/{item.shortCode}</span>{item.campaign && <span>{item.campaign}</span>}
          <span className="crm-tabnum">{formatCount(item.submissionCount)}{item.maxSubmissions ? ` of ${formatCount(item.maxSubmissions)}` : ''} {item.submissionCount === 1 ? 'registration' : 'registrations'}</span></small>
      </div>
    </div>}>
      <button type="button" className="adm-btn" onClick={copy}><Icon name="copy" />Copy link</button>
      <a className="adm-btn" href={`/r/${item.shortCode}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open form</a>
      <RowMenu label="More drive actions" items={more} trigger={<><Icon name="more" /><span className="sr-only">More</span></>} className={styles.moreButton} />
    </PageToolbar>

    <div className={styles.tabsRow}>
      <ViewTabs label="School drive sections" value={tab} onChange={choose} items={[
        { key: 'builder', label: dirty ? 'Form builder •' : 'Form builder', icon: 'edit', count: item.fields.filter((field) => field.enabled).length },
        { key: 'qr', label: 'QR & link', icon: 'link' },
        { key: 'submissions', label: 'Registrations', icon: 'people', count: item.submissionCount },
        { key: 'settings', label: 'Settings', icon: 'settings' },
      ]} />
    </div>

    <div role="tabpanel" aria-label={{ builder: 'Form builder', qr: 'QR & link', submissions: 'Registrations', settings: 'Settings' }[tab]}>
      {tab === 'builder' && <FormBuilder item={item} request={request} onSaved={saved} onDirtyChange={setDirty} toast={toast} />}
      {tab === 'qr' && <DriveQrPanel item={item} toast={toast} />}
      {tab === 'submissions' && <LeadsManager fixedFilters={{ form: item.id }} syncUrl={false} formId={item.id} heading={`Registrations at ${item.school.name}`} />}
      {tab === 'settings' && <DriveSettings item={item} request={request} onSaved={saved} toast={toast} onArchive={() => setConfirm('archive')} onDelete={() => setConfirm('delete')} onStep={step} />}
    </div>

    <ConfirmDialog open={Boolean(confirm)} busy={working} error={confirm?.error} tone="danger" requireText={kind === 'delete' ? 'DELETE' : undefined}
      title={kind === 'delete' ? `Delete ${item.school.name}?` : `Archive ${item.school.name}?`} confirmLabel={kind === 'delete' ? 'Delete drive' : 'Archive'}
      onConfirm={remove} onCancel={() => setConfirm(null)}>
      {kind === 'delete' ? 'The drive has no registrations. Its form, link and QR code are removed for good; printed posters stop working.'
        : `The link and QR code will show “Registration closed”. ${formatCount(item.submissionCount)} ${item.submissionCount === 1 ? 'registration stays' : 'registrations stay'} in Leads, and you can restore the drive later.`}
    </ConfirmDialog>
  </div>;
}
