'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './Detail.module.css';

// Sticky "On this page" anchor bar. All sections stay rendered, so these are links, not ARIA tabs.
export default function SectionNav({ items }) {
  const [active, setActive] = useState(items[0]?.id);
  const listRef = useRef(null);

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!window.IntersectionObserver || !sections.length) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach((section) => observer.observe(section));
    // Short final sections never reach the observer band, so mark the last one at the page end.
    const onScroll = () => { if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(sections.at(-1).id); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, [items]);

  // Keep the active link visible when the bar scrolls sideways (mobile).
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector('[aria-current="true"]');
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

  return <nav className={styles.sectionNav} aria-label="On this page">
    <div className="container">
      <ul ref={listRef}>{items.map((item) => <li key={item.id}>
        <a href={`#${item.id}`} aria-current={active === item.id ? 'true' : undefined} onClick={() => setActive(item.id)}>{item.label}{item.count != null && <span>{item.count}</span>}</a>
      </li>)}</ul>
    </div>
  </nav>;
}
