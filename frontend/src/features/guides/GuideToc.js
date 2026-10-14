'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Guides.module.css';

// "On this page": a sticky numbered rail on wide screens and a closed <details> disclosure below
// 1180px. Links are plain anchors, so they work without JS; scroll-spy only adds aria-current.
export default function GuideToc({ items, disclosure = true, className = '' }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!window.IntersectionObserver || !sections.length) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  const list = (closeOnPick) => <ol className={styles.tocList}>{items.map((item, index) => <li key={item.id} className={item.mobileOnly ? styles.tocMobileOnly : undefined}>
    <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined} onClick={(event) => { setActive(item.id); if (closeOnPick) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
      <span aria-hidden="true">{item.number ?? String(index + 1).padStart(2, '0')}</span>{item.label}
    </a>
  </li>)}</ol>;
  const current = items.find((item) => item.id === active);

  return <>
    <nav className={`${styles.tocRail} ${className}`} aria-label="On this page">
      <p className={styles.tocTitle}><Icon name="guidesToc" />On this page</p>
      {list()}
    </nav>
    {disclosure && <details className={styles.tocDisclosure}>
      <summary><Icon name="guidesToc" /><span>On this page <small>· {items.length} sections</small></span>{current && <em>{current.label}</em>}<Icon name="chevron" /></summary>
      <nav aria-label="On this page">{list(true)}</nav>
    </details>}
  </>;
}
