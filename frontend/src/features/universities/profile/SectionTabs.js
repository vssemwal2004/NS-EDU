'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './Profile.module.css';

// Sticky in-page navigation. Plain anchors (work without JS); the observer only marks the section in view
// and keeps the active tab visible in the horizontally scrolling strip on phones.
export default function SectionTabs({ sections }) {
  const [active, setActive] = useState(sections[0]?.id);
  const list = useRef(null);

  useEffect(() => {
    const targets = sections.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!targets.length || !window.IntersectionObserver) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-30% 0px -60% 0px' });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const strip = list.current;
    const link = strip?.querySelector('[aria-current="true"]');
    if (!strip || !link || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2, behavior: 'auto' });
  }, [active]);

  return <nav className={styles.tabs} aria-label="Profile sections">
    <div className={`lux-container ${styles.tabsInner}`}>
      <ul ref={list}>
        {sections.map((section) => <li key={section.id}>
          <a href={`#${section.id}`} aria-current={active === section.id ? 'true' : undefined} onClick={() => setActive(section.id)}>{section.label}</a>
        </li>)}
      </ul>
    </div>
  </nav>;
}
