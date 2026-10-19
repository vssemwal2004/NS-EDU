'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import accountStyles from '@/features/auth/Account.module.css';
import { STATUS_LABELS, statusTone } from './apply-options';
import styles from './MyApplications.module.css';

const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// "My applications" card for the signed-in account page.
export default function MyApplications() {
  const [state, setState] = useState({ items: null, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api('/applications/mine', { signal: controller.signal })
      .then((data) => setState({ items: data.items, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ items: null, error: error.message }); });
    return () => controller.abort();
  }, [attempt]);

  const { items, error } = state;
  return <section id="applications" className={accountStyles.card} aria-labelledby="applications-title">
    <div className={accountStyles.cardHead}>
      <h2 id="applications-title"><span className={accountStyles.cardIcon}><Icon name="eligibility" /></span>My applications</h2>
      <Link className="text-link" href="/apply">New application<Icon name="arrow" /></Link>
    </div>
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" className="button button--ghost" onClick={() => { setState({ items: null, error: '' }); setAttempt((count) => count + 1); }}><Icon name="refresh" />Try again</button></div>
      : items === null ? <span className={`${accountStyles.skeleton} ${styles.skeleton}`} aria-hidden="true" />
        : items.length ? <ul className={styles.list}>
          {items.map((item) => {
            const course = [item.preference.courseName, item.preference.programmeName].filter(Boolean).join(' · ');
            return <li key={item.ref} className={styles.item}>
              <div className={styles.text}>
                <h3>{item.preference.institutionName}</h3>
                <p>{course || 'Programme to be discussed'} · {item.preference.intakeYear} intake</p>
                <p className={styles.meta}><span>Ref <strong>{item.ref}</strong></span><span>Submitted {date.format(new Date(item.createdAt))}</span></p>
              </div>
              <span className={styles.chip} data-tone={statusTone(item.status)}>{STATUS_LABELS[item.status] || item.statusLabel}</span>
            </li>;
          })}
        </ul>
          : <div className={accountStyles.empty}>
            <span className={accountStyles.emptyIcon}><Icon name="eligibility" /></span>
            <div><h3>No applications yet</h3><p>Found a university you like? Apply through Gyaan Vidhya and our admissions team will guide you through the next steps.</p>
              <div className={accountStyles.emptyActions}><Link className="button button--primary" href="/apply">Start an application<Icon name="arrow" /></Link></div></div>
          </div>}
    {items?.length > 0 && <p className={accountStyles.cardText}>A counsellor contacts you about each application. Status updates appear here.</p>}
  </section>;
}
