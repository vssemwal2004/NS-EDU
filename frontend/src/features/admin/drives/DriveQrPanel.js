'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatCount, formatDateTime } from '@/features/admin/leads/lead-format';
import { Panel } from '@/features/admin/ui/Page';
import { copyText, qrUrl } from './drive-format';
import styles from './Drives.module.css';

export default function DriveQrPanel({ item, toast }) {
  const local = /^http:\/\/(localhost|127\.)/.test(item.publicUrl);
  async function copy() {
    if (await copyText(item.publicUrl)) toast.success('Link copied.');
    else toast.error('Copy failed. Select the link and copy it by hand.');
  }
  return <div className={styles.qrLayout}>
    <Panel title="QR code" description="Print it on the poster or show it on a screen at the school.">
      <div className={styles.qrBody}>
        <div className={styles.qrFrame}>
          {/* The SVG endpoint stays sharp at any size; the admin session cookie authorises it. */}
          <img src={`/api/admin/drives/${item.id}/qr.svg`} width={180} height={180} alt={`QR code that opens the registration form for ${item.school.name}`} />
          {item.status !== 'active' && <span className={styles.qrBadge}>{item.status === 'archived' ? 'Archived' : 'Registration closed'}</span>}
        </div>
        <div className={styles.qrActions}>
          <Link className="adm-btn adm-btn--primary" href={`/admin/drives/${item.id}/poster`} target="_blank" rel="noopener"><Icon name="printer" />Print poster</Link>
          <a className="adm-btn" href={qrUrl(item.id, 'png', 1024)}><Icon name="download" />PNG</a>
          <a className="adm-btn" href={qrUrl(item.id, 'png', 2048)}><Icon name="download" />PNG for print</a>
          <a className="adm-btn" href={qrUrl(item.id, 'svg')}><Icon name="download" />SVG</a>
        </div>
      </div>
    </Panel>

    <Panel title="Registration link">
      <div className={styles.linkRow}>
        <label className="sr-only" htmlFor="drive-link">Registration link</label>
        <input id="drive-link" className="adm-input" value={item.publicUrl} readOnly onFocus={(event) => event.target.select()} />
        <button type="button" className="adm-btn" onClick={copy}><Icon name="copy" />Copy</button>
        <a className="adm-btn adm-btn--ghost" href={`/r/${item.shortCode}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open</a>
      </div>
      <dl className={styles.facts}>
        <div><dt>Short code</dt><dd className={styles.code}>{item.shortCode}</dd></div>
        <div><dt>Registrations</dt><dd className="crm-tabnum">{formatCount(item.submissionCount)}{item.maxSubmissions ? ` of ${formatCount(item.maxSubmissions)}` : ''}</dd></div>
        <div><dt>Last registration</dt><dd>{item.lastSubmissionAt ? formatDateTime(item.lastSubmissionAt) : 'None yet'}</dd></div>
      </dl>
      <p className={styles.note}><Icon name="lock" />The link and QR code never change, even when you edit the form or the school details. Printed posters keep working.</p>
      {local && <p className={styles.note} data-tone="warn" role="note"><Icon name="alert" />The link points at {new URL(item.publicUrl).host}. Set PUBLIC_SITE_URL on the API to the live website address before printing posters.</p>}
    </Panel>
  </div>;
}
