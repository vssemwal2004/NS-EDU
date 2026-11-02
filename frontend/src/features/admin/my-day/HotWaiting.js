'use client';
// "Hot leads waiting for a first call": from the CRM dashboard (people with analytics access) or the leads list.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { Avatar } from '@/features/admin/crm/ui';
import { formatNumber, relativeTime } from '@/features/admin/crm/format';
import { telHref, whatsappHref } from '@/features/admin/lead-actions/contact';
import { PriorityText } from '@/features/admin/leads/lead-bits';
import { Panel } from '@/features/admin/ui/Page';
import styles from './MyDay.module.css';

const LIMIT = 8;
const fromLead = (lead) => ({ id: lead.id, ref: lead.ref, name: lead.applicant?.fullName, phone: lead.applicant?.phone, createdAt: lead.createdAt, priority: lead.crm?.priority, assignee: '' });

export default function HotWaiting({ analytics }) {
  const { admin, request } = useAdminSession();
  const [state, setState] = useState({ key: '', items: null, total: 0, error: '' });
  const [version, setVersion] = useState(0);
  const key = `${analytics}|${version}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const load = analytics
      ? request('/crm/dashboard?range=7d', { signal }).then((data) => ({ items: (data.actions?.hotWaiting ?? []).map((card) => ({ id: card.id, ref: card.ref, name: card.name, phone: card.phone, createdAt: card.createdAt, priority: card.priority, assignee: card.assignee })), total: data.actions?.hotWaiting?.length ?? 0 }))
      : request('/leads?heat=hot&status=new&limit=25', { signal }).then((data) => ({ items: data.items.map(fromLead), total: data.total }));
    load.then((result) => { if (!signal.aborted) setState({ key, error: '', ...result }); })
      .catch((failure) => { if (!signal.aborted && failure.name !== 'AbortError') setState({ key, items: null, total: 0, error: failure.message || 'Could not load the hot leads.' }); });
    return () => controller.abort();
  }, [analytics, key, request]);

  const loading = state.key !== key;
  const items = state.items?.slice(0, LIMIT);
  return <Panel title="Hot leads waiting" description="Hot leads still in New: they have not had a first call yet." meta={!loading && items?.length ? `${formatNumber(state.total)}` : undefined} flush
    actions={<Link href="/admin/leads?heat=hot&status=new" className="adm-btn adm-btn--sm adm-btn--ghost">See all</Link>}>
    {loading && !state.error && <div className={styles.hotSkeleton}><i /><i /><i /></div>}
    {state.error && !loading && <div className={styles.inlineError} role="alert"><span>{state.error}</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => setVersion((value) => value + 1)}>Retry</button></div>}
    {!loading && items && items.length === 0 && <p className={styles.none}>No hot leads waiting</p>}
    {!loading && items && items.length > 0 && <ul className={styles.hotList}>
      {items.map((lead) => <li key={lead.id} className={styles.hotRow}>
        <div className={styles.hotInfo}>
          <Link href={`/admin/leads/${lead.id}`} className={styles.leadName} title={lead.name}>{lead.name || 'Lead'}</Link>
          <span className={styles.hotSub}>{lead.phone && <span className="crm-tabnum">{lead.phone}</span>}<span title={`Added ${relativeTime(lead.createdAt)}`}>{relativeTime(lead.createdAt)}</span>
            <PriorityText priority={lead.priority} dash={false} />
            {lead.assignee && admin?.leadScope !== 'own' && <Avatar name={lead.assignee} email={lead.assignee} size={20} />}</span>
        </div>
        {lead.phone && <div className={styles.hotActions}>
          <a className="adm-btn adm-btn--sm adm-btn--icon" href={telHref(lead.phone)} aria-label={`Call ${lead.name}`} title="Call"><Icon name="phone" /></a>
          <a className="adm-btn adm-btn--sm adm-btn--icon" href={whatsappHref(lead.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${lead.name}`} title="WhatsApp"><Icon name="chat" /></a>
        </div>}
      </li>)}
    </ul>}
    {!loading && state.total > LIMIT && <p className={styles.none}>{formatNumber(state.total)} waiting in total.</p>}
  </Panel>;
}
