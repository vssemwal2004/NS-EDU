'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import RowMenu from '@/features/admin/crm/RowMenu';
import { relativeTime } from '@/features/admin/crm/format';
import { useToaster } from '@/features/admin/crm/toast';
import { PageToolbar, Panel } from '@/features/admin/ui/Page';
import { formatShort, formatSize, formatWhen } from './content-format';
import styles from './Content.module.css';

const SKELETON = ['62%', '48%', '80%', '55%', '70%', '44%'];

// Every student-facing copy/config entry (site_content collection), with when and by whom it was last edited.
export default function ContentList() {
  const router = useRouter();
  const { request } = useAdminSession();
  const toast = useToaster();
  const [state, setState] = useState({ items: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [reset, setReset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request('/content', { signal: controller.signal })
      .then(({ items }) => setState({ items, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ items: null, error: error.message || 'Could not load site content.' }); });
    return () => controller.abort();
  }, [request, attempt]);
  const retry = useCallback(() => { setState({ items: null, error: '' }); setAttempt((value) => value + 1); }, []);

  async function runReset() {
    setBusy(true); setResetError('');
    try {
      const { item } = await request(`/content/${reset.key}/reset`, { method: 'POST' });
      setState((current) => ({ ...current, items: current.items.map((entry) => (entry.key === item.key ? { ...entry, ...item } : entry)) }));
      toast.success(`“${reset.label}” reset to the default content. The previous version is kept in Versions.`);
      setReset(null);
    } catch (error) { setResetError(error.message); } finally { setBusy(false); }
  }

  const items = state.items ?? [];
  const latest = items.reduce((best, item) => (item.updatedBy && (!best || new Date(item.updatedAt) > new Date(best.updatedAt)) ? item : best), null);
  const summary = state.items
    ? <><strong>{items.length}</strong> content entries{latest ? <> · last edited {relativeTime(latest.updatedAt)} by {latest.updatedBy}</> : ' · all at their defaults'}</>
    : null;

  return <>
    <PageToolbar summary={summary ?? (state.error ? 'Site content' : 'Loading content…')}>
      <span className={styles.toolbarNote}><Icon name="clock" />Changes reach the site within about a minute</span>
    </PageToolbar>

    <Panel flush>
      {state.error ? <div className={styles.state} role="alert">
        <span className={styles.stateIcon} data-tone="bad"><Icon name="alert" /></span>
        <strong>Could not load site content</strong><p>{state.error}</p>
        <button type="button" className="adm-btn" onClick={retry}><Icon name="refresh" />Try again</button>
      </div> : <div className={styles.tableScroll}>
        <table className={styles.table} aria-busy={!state.items}>
          <caption className="sr-only">Site content entries</caption>
          <thead><tr>
            <th scope="col">Entry</th>
            <th scope="col" className={styles.colDescription}>What it controls</th>
            <th scope="col">Last edited</th>
            <th scope="col" className={styles.num}>Size</th>
            <th scope="col" className={styles.num}>Versions</th>
            <th scope="col" className={styles.colMenu}><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {!state.items ? SKELETON.map((width, index) => <tr key={index} className={styles.skeletonRow} aria-hidden="true">
              <td><span style={{ width }} /><span style={{ width: '30%' }} /></td>
              <td className={styles.colDescription}><span style={{ width: '90%' }} /></td>
              <td><span style={{ width: '70%' }} /></td><td><span /></td><td><span /></td><td />
            </tr>) : items.map((item) => <tr key={item.key} className={styles.clickRow} onClick={() => router.push(`/admin/content/${item.key}`)}>
              <td>
                <Link className={styles.entryLink} href={`/admin/content/${item.key}`} title={`Key: ${item.key}`} onClick={(event) => event.stopPropagation()}>{item.label}</Link>
              </td>
              <td className={styles.colDescription}><span className={styles.truncate} title={item.description}>{item.description}</span></td>
              <td>
                {item.updatedBy ? <>
                  <span className={`${styles.when} crm-tabnum`} title={formatWhen(item.updatedAt)}>{formatShort(item.updatedAt)}</span>
                  <small className={styles.meta} title={item.updatedBy}>{item.updatedBy}</small>
                </> : <span className={styles.faint}>Default</span>}
              </td>
              <td className={`${styles.num} crm-tabnum`}>{formatSize(item.size)}</td>
              <td className={`${styles.num} crm-tabnum`}>{item.versions || <span className={styles.faint}>—</span>}</td>
              <td className={styles.colMenu} onClick={(event) => event.stopPropagation()}>
                <RowMenu label={`Actions for ${item.label}`} items={[
                  { key: 'edit', label: 'Edit', icon: 'edit', href: `/admin/content/${item.key}` },
                  { key: 'versions', label: 'Previous versions', icon: 'history', href: `/admin/content/${item.key}?tab=versions`, hint: String(item.versions) },
                  { divider: true },
                  { key: 'reset', label: 'Reset to default…', icon: 'undo', tone: 'danger', disabled: !item.updatedBy, reason: 'Already the default content', onSelect: () => { setResetError(''); setReset(item); } },
                ]} />
              </td>
            </tr>)}
          </tbody>
        </table>
        {state.items && !items.length && <p className={styles.emptyLine}>No content entries yet. They are created from their defaults by the API seed.</p>}
      </div>}
    </Panel>

    <ConfirmDialog open={Boolean(reset)} tone="danger" icon="undo" title={`Reset “${reset?.label ?? ''}” to default?`} confirmLabel="Reset to default" busy={busy} error={resetError}
      onCancel={() => setReset(null)} onConfirm={runReset}>
      The original default copy goes live within about a minute. The current version is kept in Previous versions, so you can restore it.
    </ConfirmDialog>
  </>;
}
