'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { CHANNELS, OPEN_STAGES } from '@/features/admin/crm/meta';
import { Avatar, FollowUpBadge, StageChip } from '@/features/admin/crm/ui';
import { useToaster } from '@/features/admin/crm/toast';
import LogCallDialog from '@/features/admin/lead-actions/LogCallDialog';
import { useServerList } from '@/features/admin/table/useServerList';
import { Timeline } from './LeadActivity';
import { channelOf, courseText, whatsAppLink } from './lead-format';
import styles from './Leads.module.css';

export default function LeadPreview({ item, request, scope, canNotes, onClose, onChanged }) {
  const toast = useToaster();
  const [logging, setLogging] = useState(false);
  const panel = useRef(null);
  const opener = useRef(null);
  const activity = useServerList(request, `/crm/leads/${item.id}/timeline`, {}, { scope });
  const name = item.applicant?.fullName || 'Name not provided';
  const phone = item.applicant?.phone;
  const whatsapp = whatsAppLink(phone);
  const course = courseText(item.preference);
  const subtitle = course === 'Not specified' ? item.ref : course;
  const channel = channelOf(item);
  const open = OPEN_STAGES.includes(item.status);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  function close() {
    onClose();
    opener.current?.focus({ preventScroll: true });
  }

  return <aside ref={panel} tabIndex={-1} className={styles.preview} aria-label={`Preview of ${name}`}>
    <header className={styles.previewHead}>
      <Avatar name={name} size={42} />
      <div><h2>{name}</h2><p>{subtitle}</p></div>
      <button type="button" className="adm-btn adm-btn--sm adm-btn--icon adm-btn--ghost" onClick={close} aria-label="Close lead preview"><Icon name="close" /></button>
    </header>
    <div className={styles.previewMeta}><StageChip status={item.status} size="sm" /><span>{CHANNELS[channel]?.label ?? channel}</span></div>
    <div className={styles.previewActions}>
      {canNotes && <button type="button" className="adm-btn adm-btn--sm adm-btn--primary" onClick={() => setLogging(true)}><Icon name="note" />Log call</button>}
      {whatsapp && <a className="adm-btn adm-btn--sm" href={whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp</a>}
      <Link className="adm-btn adm-btn--sm" href={`/admin/leads/${item.id}`}><Icon name="arrow" />Open lead</Link>
    </div>
    {open && <div className={styles.previewFollow}><strong>Next follow-up</strong><FollowUpBadge at={item.crm?.nextFollowUpAt} /></div>}
    <Timeline title="Recent activity" timeline={{ items: activity.data?.items?.slice(0, 3) ?? [], loaded: Boolean(activity.data), error: activity.error }} onRetry={activity.reload} compact />
    {canNotes && <LogCallDialog open={logging} lead={{ id: item.id, name, phone }} onClose={() => setLogging(false)}
      onLogged={({ followUpAt, warning }) => {
        activity.reload();
        onChanged();
        if (warning) toast.warn(warning);
        else toast.success(followUpAt ? 'Call logged and next follow-up planned' : 'Call logged');
      }} />}
  </aside>;
}
