'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatCount, formatDateTime } from '@/features/admin/leads/lead-format';
import rm from '@/features/admin/ResourceManager.module.css';
import { copyText } from './drive-format';
import styles from './Drives.module.css';

export default function DriveQrPanel({ item, notify }) {
  const base = `/api/admin/drives/${item.id}`;
  const local = /^http:\/\/(localhost|127\.)/.test(item.publicUrl);
  async function copy() {
    if (await copyText(item.publicUrl)) notify('Link copied.');
    else notify('Copy failed. Select the link and copy it by hand.', 'error');
  }
  return <div className={styles.qrLayout}>
    <section className={styles.panel} aria-labelledby="qr-heading">
      <h2 id="qr-heading" className={styles.panelTitle}>QR code</h2>
      <div className={styles.qrFrame}>
        {/* The SVG endpoint stays sharp at any size; the admin session cookie authorises it. */}
        <img src={`${base}/qr.svg`} width={240} height={240} alt={`QR code that opens the registration form for ${item.school.name}`} />
        {item.status !== 'active' && <span className={styles.qrBadge}>{item.status === 'archived' ? 'Archived' : 'Registration closed'}</span>}
      </div>
      <div className={styles.downloads}>
        <a className="button button--outline" href={`${base}/qr.png?size=1024&download=1`}><Icon name="arrowUp" className={styles.down} />PNG</a>
        <a className="button button--outline" href={`${base}/qr.png?size=2048&download=1`}><Icon name="arrowUp" className={styles.down} />PNG for print</a>
        <a className="button button--outline" href={`${base}/qr.svg?download=1`}><Icon name="arrowUp" className={styles.down} />SVG</a>
      </div>
      <Link className="button button--primary" href={`/admin/drives/${item.id}/poster`} target="_blank" rel="noopener"><Icon name="comparePrint" />Print poster</Link>
    </section>

    <section className={styles.panel} aria-labelledby="link-heading">
      <h2 id="link-heading" className={styles.panelTitle}>Registration link</h2>
      <div className={styles.linkRow}>
        <label className="sr-only" htmlFor="drive-link">Registration link</label>
        <input id="drive-link" className={rm.input} value={item.publicUrl} readOnly onFocus={(event) => event.target.select()} />
        <button type="button" className="button button--outline" onClick={copy}><Icon name="compareLink" />Copy</button>
      </div>
      <a className={styles.openLink} href={`/r/${item.shortCode}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open the form as students see it</a>
      <dl className={styles.facts}>
        <div><dt>Short code</dt><dd className={styles.code}>{item.shortCode}</dd></div>
        <div><dt>Registrations</dt><dd>{formatCount(item.submissionCount)}{item.maxSubmissions ? ` of ${formatCount(item.maxSubmissions)}` : ''}</dd></div>
        <div><dt>Last registration</dt><dd>{item.lastSubmissionAt ? formatDateTime(item.lastSubmissionAt) : 'None yet'}</dd></div>
      </dl>
      <p className={styles.notice}><Icon name="lock" />This link and QR code never change, even when you edit the form or the school details. Printed posters keep working.</p>
      {local && <p className={styles.warning} role="note"><Icon name="shield" />The link points at {new URL(item.publicUrl).host}. Set PUBLIC_SITE_URL on the API to the live website address before printing posters.</p>}
    </section>
  </div>;
}
