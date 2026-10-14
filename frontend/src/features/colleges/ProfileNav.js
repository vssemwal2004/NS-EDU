'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Profile.module.css';

// "On this page" anchor bar. aria-current follows the section in view; once the hero has
// scrolled away the bar also shows the college's short name and a jump to its courses.
export default function ProfileNav({ sections, shortName, heroId }) {
  const [active, setActive] = useState(sections[0].id);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const Observer = window.IntersectionObserver;
    if (!Observer) return undefined;
    const visible = new Map();
    const sectionObserver = new Observer((entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
      const current = sections.find((item) => visible.get(item.id));
      if (current) setActive(current.id);
    }, { rootMargin: '-140px 0px -55% 0px' });
    for (const item of sections) { const node = document.getElementById(item.id); if (node) sectionObserver.observe(node); }
    const hero = document.getElementById(heroId);
    const heroObserver = hero && new Observer(([entry]) => setCompact(!entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    if (hero) heroObserver.observe(hero);
    return () => { sectionObserver.disconnect(); heroObserver?.disconnect(); };
  }, [sections, heroId]);

  return <nav className={styles.nav} aria-label="On this page" data-compact={compact || undefined}>
    <div className={`container ${styles.navInner}`}>
      <ul className={styles.navLinks}>
        {sections.map((item) => <li key={item.id}><a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined} onClick={() => setActive(item.id)}>{item.label}</a></li>)}
      </ul>
      <div className={styles.navAside} aria-hidden={!compact || undefined}>
        <strong>{shortName}</strong>
        <a className="button button--primary" href="#courses" tabIndex={compact ? undefined : -1}><Icon name="compare" />Compare courses</a>
      </div>
    </div>
  </nav>;
}
