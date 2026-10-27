'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { useToast } from '@/features/admin/data/useToast';
import LeadsManager from '@/features/admin/leads/LeadsManager';
import { formatCount } from '@/features/admin/leads/lead-format';
import { clearServerListCache } from '@/features/admin/table/useServerList';
import rm from '@/features/admin/ResourceManager.module.css';
import { copyText, driveStatusLabel } from './drive-format';
import DriveQrPanel from './DriveQrPanel';
import DriveSettings from './DriveSettings';
import FormBuilder from './FormBuilder';
import { useUnsavedGuard } from './useUnsavedGuard';
import styles from './Drives.module.css';

const TABS = [
  { value: 'builder', label: 'Form builder', icon: 'edit' },
  { value: 'qr', label: 'QR & link', icon: 'compareLink' },
  { value: 'submissions', label: 'Registrations', icon: 'people' },
  { value: 'settings', label: 'Settings', icon: 'settings' },
];
const DISCARD = 'The form has unsaved changes. Discard them?';

export default function DriveDetail({ id, initialTab = 'builder' }) {
  const { request } = useAdminSession();
  const [toast, notify] = useToast();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS.some((entry) => entry.value === initialTab) ? initialTab : 'builder');
  const [dirty, setDirty] = useState(false);
  const tabRefs = useRef({});
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
    window.history.replaceState(null, '', `/admin/drives/${id}${next === 'builder' ? '' : `?tab=${next}`}`);
  }
  // Arrow keys move between tabs (WAI-ARIA tabs pattern); only the selected tab is in the tab order.
  function onTabKey(event) {
    const index = TABS.findIndex((entry) => entry.value === tab);
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : delta ? (index + delta + TABS.length) % TABS.length : null;
    if (target === null) return;
    event.preventDefault();
    choose(TABS[target].value);
    tabRefs.current[TABS[target].value]?.focus();
  }

  if (error) return <div className={styles.detailError} role="alert"><Icon name="shield" /><div><strong>Could not open this drive</strong><p>{error}</p></div>
    <Link className="button button--outline" href="/admin/drives">All drives</Link><button type="button" className="button button--primary" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Try again</button></div>;
  if (!item) return <div className={styles.skeleton} aria-busy="true"><span /><span /><span /></div>;

  async function copy() {
    if (await copyText(item.publicUrl)) notify('Link copied.');
    else notify('Copy failed. Open the QR & link tab to copy it.', 'error');
  }

  return <div className={styles.detail}>
    <Link href="/admin/drives" className={styles.backLink}><Icon name="arrow" />All school drives</Link>
    <div className={styles.detailHead}>
      <div className={styles.headText}>
        <p className={styles.headMeta}><span className={styles.pill} data-status={item.status}>{driveStatusLabel(item.status)}</span><span className={styles.code}>/r/{item.shortCode}</span>{item.campaign && <span>{item.campaign}</span>}</p>
        <h2>{item.school.name}</h2>
        <p className={styles.headPlace}><Icon name="location" />{[item.school.city !== item.school.district && item.school.city, item.school.district, item.school.state].filter(Boolean).join(', ')}</p>
      </div>
      <div className={styles.headStats}>
        <strong>{formatCount(item.submissionCount)}</strong><span>{item.submissionCount === 1 ? 'registration' : 'registrations'}</span>
      </div>
      <div className={styles.headActions}>
        <button type="button" className="button button--outline" onClick={copy}><Icon name="compareLink" />Copy link</button>
        <a className="button button--ghost" href={`/r/${item.shortCode}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open form</a>
      </div>
    </div>

    <div className={styles.tabs} role="tablist" aria-label="School drive sections" onKeyDown={onTabKey}>
      {TABS.map((entry) => <button key={entry.value} ref={(node) => { tabRefs.current[entry.value] = node; }} type="button" role="tab" id={`drive-tab-${entry.value}`}
        aria-selected={tab === entry.value} aria-controls={`drive-panel-${entry.value}`} tabIndex={tab === entry.value ? 0 : -1} onClick={() => choose(entry.value)}>
        <Icon name={entry.icon} />{entry.label}{entry.value === 'builder' && dirty && <span className={styles.dirtyDot} aria-label="unsaved changes" />}
      </button>)}
    </div>

    <div role="tabpanel" id={`drive-panel-${tab}`} aria-labelledby={`drive-tab-${tab}`} className={styles.tabPanel}>
      {tab === 'builder' && <FormBuilder item={item} request={request} onSaved={saved} onDirtyChange={setDirty} notify={notify} />}
      {tab === 'qr' && <DriveQrPanel item={item} notify={notify} />}
      {tab === 'submissions' && <LeadsManager fixedFilters={{ form: item.id }} syncUrl={false} formId={item.id} heading={`Registrations at ${item.school.name}`} />}
      {tab === 'settings' && <DriveSettings item={item} request={request} onSaved={saved} notify={notify} />}
    </div>
    {toast && <p className={rm.toast} data-tone={toast.tone} role="status"><Icon name={toast.tone === 'error' ? 'shield' : 'check'} />{toast.message}</p>}
  </div>;
}
