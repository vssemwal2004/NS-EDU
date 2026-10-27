'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import styles from './Poster.module.css';

// A4 poster for the school notice board. `gv-poster-sheet` / `gv-no-print` are read by the print
// stylesheet next to the poster page, which hides the admin shell when printing.
export default function DrivePoster({ id }) {
  const { request } = useAdminSession();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    request(`/drives/${id}`, { signal: controller.signal }).then(({ item: loaded }) => setItem(loaded)).catch((failure) => {
      if (failure.name !== 'AbortError') setError(failure.message);
    });
    return () => controller.abort();
  }, [id, request]);

  if (error) return <p className={styles.error} role="alert">{error} <Link href={`/admin/drives/${id}`}>Back to the drive</Link></p>;
  if (!item) return <p className={styles.loading} role="status">Preparing the poster…</p>;
  const shortUrl = item.publicUrl.replace(/^https?:\/\//, '');
  const place = [item.school.district, item.school.state].filter(Boolean).join(', ');

  return <div className={styles.wrap}>
    <div className={`${styles.toolbar} gv-no-print`}>
      <Link className="button button--ghost" href={`/admin/drives/${id}?tab=qr`}><Icon name="arrow" className={styles.back} />Back to the drive</Link>
      <p>A4 portrait. In the print dialog, turn off headers and footers for a clean sheet.</p>
      <button type="button" className="button button--primary" onClick={() => window.print()}><Icon name="comparePrint" />Print or save as PDF</button>
    </div>
    {item.status !== 'active' && <p className={`${styles.warning} gv-no-print`} role="note"><Icon name="shield" />This drive is {item.status === 'archived' ? 'archived' : 'closed'}: students who scan the code will see “Registration closed”.</p>}

    <article className={`${styles.sheet} gv-poster-sheet`} aria-label="Poster preview">
      <div className={styles.brand}><Brand priority /></div>
      <p className={styles.eyebrow}>Student registration</p>
      <h1 className={styles.school}>{item.school.name}</h1>
      {place && <p className={styles.place}>{place}</p>}
      <div className={styles.qr}>
        <img src={`/api/admin/drives/${id}/qr.svg`} alt={`QR code for ${shortUrl}`} width={420} height={420} />
      </div>
      <p className={styles.scan}>Scan with your phone camera to register</p>
      <p className={styles.url}>or open <strong>{shortUrl}</strong></p>
      <ol className={styles.steps}>
        <li><span>1</span>Scan the QR code or type the link</li>
        <li><span>2</span>Fill in your name, mobile number and class</li>
        <li><span>3</span>Show your reference number to the Gyaan Vidhya team</li>
      </ol>
      <p className={styles.footer}>Free · Takes about a minute · Your details are used only to guide you on courses and admissions</p>
    </article>
  </div>;
}
