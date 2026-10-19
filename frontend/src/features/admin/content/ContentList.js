'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { formatSize, formatWhen } from './content-format';
import styles from './Content.module.css';

// Every student-facing copy/config entry (site_content collection), with when and by whom it was last edited.
export default function ContentList() {
  const [state, setState] = useState({ items: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    api('/admin/content', { signal: controller.signal })
      .then(({ items }) => setState({ items, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ items: [], error: error.message }); });
    return () => controller.abort();
  }, []);

  return <div className={styles.page}>
    <p className={styles.lead}>Everything students read outside the catalogue — page copy, homepage shortcuts, tool settings and site images — is stored here. Changes publish to the site within about a minute.</p>
    {state.error && <p className={styles.error} role="alert"><Icon name="shield" />{state.error}</p>}
    {!state.items ? <p className={styles.muted} role="status">Loading content…</p> : <ul className={styles.list}>
      {state.items.map((item) => <li key={item.key}>
        <Link className={styles.card} href={`/admin/content/${item.key}`}>
          <span className={styles.cardHead}><strong>{item.label}</strong><code>{item.key}</code></span>
          <span className={styles.cardText}>{item.description}</span>
          <span className={styles.meta}>
            <span><Icon name="calendar" />{formatWhen(item.updatedAt)}{item.updatedBy ? ` · ${item.updatedBy}` : ' · default'}</span>
            <span><Icon name="layers" />{formatSize(item.size)} · {item.versions} saved {item.versions === 1 ? 'version' : 'versions'}</span>
          </span>
          <span className={styles.open}>Edit<Icon name="arrow" /></span>
        </Link>
      </li>)}
    </ul>}
  </div>;
}
