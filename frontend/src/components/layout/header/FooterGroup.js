'use client';
import { useId, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from '../SiteFooter.module.css';

// Footer link column. On narrow screens it becomes a disclosure so the footer
// stays short; the server (and first client) render is the expanded desktop form.
const query = '(max-width: 650px)';
function subscribe(onChange) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const isNarrow = () => window.matchMedia(query).matches;

export default function FooterGroup({ title, links, variant }) {
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false);
  const [open, setOpen] = useState(false);
  const listId = useId();
  return <nav className={styles.group} data-variant={variant} aria-label={`${title} footer links`}>
    {narrow
      ? <h3><button type="button" className={styles.groupToggle} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>{title}<Icon name="chevron" /></button></h3>
      : <h3>{title}</h3>}
    <ul id={listId} hidden={narrow && !open}>
      {links.map((link) => <li key={link.href + link.label}><Link prefetch={false} href={link.href}>
        <span>{link.label}</span>{link.meta != null && <em>{link.meta}{link.metaLabel && <span className="sr-only"> {link.metaLabel}</span>}</em>}
      </Link></li>)}
    </ul>
  </nav>;
}
