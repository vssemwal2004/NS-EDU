'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { primaryNavigation, utilityLinks, isActivePath } from '@/data/navigation';
import AccountControl from './header/AccountControl';
import MegaColleges from './header/MegaColleges';
import MegaCourses from './header/MegaCourses';
import MegaExams from './header/MegaExams';
import MegaResources from './header/MegaResources';
import MobileNav from './header/MobileNav';
import PreferenceChip from './header/PreferenceChip';
import SearchPanel from './header/SearchPanel';
import { useCompareSummary } from './header/useCatalogNav';
import styles from './Header.module.css';

const panels = { colleges: MegaColleges, courses: MegaCourses, exams: MegaExams };
const panelId = (group) => `menu-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
const isTyping = (target) => /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const compare = useCompareSummary();
  const [openGroup, setOpenGroup] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const searchButton = useRef(null);
  const timers = useRef({ open: 0, close: 0, hoverAt: 0 });

  // Close transient menus whenever the route changes (React's "adjust state on prop change" pattern).
  const [routeKey, setRouteKey] = useState(pathname);
  if (routeKey !== pathname) { setRouteKey(pathname); setOpenGroup(null); setSearchOpen(false); setMobileOpen(false); }

  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setScrolled(window.scrollY > 4); };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    const pending = timers.current;
    return () => { window.removeEventListener('scroll', schedule); window.cancelAnimationFrame(frame); window.clearTimeout(pending.open); window.clearTimeout(pending.close); };
  }, []);

  // Shortcuts: "/" (outside fields) and Ctrl/Cmd+K open search.
  useEffect(() => {
    function onKey(event) {
      const slash = event.key === '/' && !isTyping(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey;
      const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!slash && !commandK) return;
      event.preventDefault();
      setOpenGroup(null);
      setSearchOpen(true);
      document.getElementById('header-search-input')?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // An open mega panel closes on Escape, outside press and page scroll.
  useEffect(() => {
    if (!openGroup) return undefined;
    const start = window.scrollY;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      navRef.current?.querySelector(`[data-group="${openGroup}"]`)?.focus();
      setOpenGroup(null);
    }
    function onPointer(event) { if (!navRef.current?.contains(event.target)) setOpenGroup(null); }
    function onScroll() { if (Math.abs(window.scrollY - start) > 48) setOpenGroup(null); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); window.removeEventListener('scroll', onScroll); };
  }, [openGroup]);

  // Hover intent: open after a short pause, close shortly after leaving. Mouse only.
  const hoverOpen = (label) => (event) => {
    if (event.pointerType !== 'mouse' || searchOpen) return;
    window.clearTimeout(timers.current.close);
    window.clearTimeout(timers.current.open);
    if (openGroup === label) return;
    const delay = openGroup ? 80 : 120;
    const openedAt = event.timeStamp + delay;
    timers.current.open = window.setTimeout(() => { timers.current.hoverAt = openedAt; setOpenGroup(label); }, delay);
  };
  const hoverClose = (event) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
    timers.current.close = window.setTimeout(() => setOpenGroup(null), 160);
  };
  const toggleGroup = (label, event) => {
    window.clearTimeout(timers.current.open);
    // A click that lands just after hover opened the panel should not immediately close it.
    if (openGroup === label && event.timeStamp - timers.current.hoverAt < 500) return;
    setSearchOpen(false);
    setOpenGroup(openGroup === label ? null : label);
  };
  const closeGroup = () => setOpenGroup(null);
  const closeSearch = (returnFocus) => { setSearchOpen(false); if (returnFocus) searchButton.current?.focus(); };
  const search = (query) => { setSearchOpen(false); setMobileOpen(false); router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search'); };
  const overlay = Boolean(openGroup && primaryNavigation.find((group) => group.label === openGroup)?.panel) || searchOpen;

  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <div className={styles.utility}>
      <div className={`container ${styles.utilityInner}`}>
        <p className={styles.utilityNote}><Icon name="calendar" />Admissions 2026–27 · confirm fees and eligibility with each institution</p>
        <div className={styles.utilityActions}>
          <PreferenceChip />
          {utilityLinks.map((link) => <Link key={link.href} href={link.href} prefetch={false}><Icon name={link.icon} />{link.label}</Link>)}
        </div>
      </div>
    </div>
    <header className={styles.header} data-scrolled={scrolled} data-search-open={searchOpen} data-panel-open={overlay}>
      <div className={`container ${styles.bar}`}>
        <Link className={styles.brand} href="/" aria-label="NSEDU home">
          <span className={styles.brandMark} aria-hidden="true"><Icon name="cap" /></span>
          <span className={styles.brandText}><span className={styles.wordmark}>NSEDU</span><span className={styles.brandTagline}>Discover · Learn · Belong</span></span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation" ref={navRef}>
          <ul>
            {primaryNavigation.map((group) => {
              const active = isActivePath(pathname, group);
              if (!group.panel && !group.items) {
                const badge = group.badge === 'compare' ? compare.count : 0;
                const href = group.badge === 'compare' && compare.courseId ? `${group.href}?course=${encodeURIComponent(compare.courseId)}` : group.href;
                return <li key={group.label}><Link className={styles.navLink} href={href} aria-current={active ? 'page' : undefined}>
                  {group.label}{badge > 0 && <><span className={styles.badge} aria-hidden="true">{badge}</span><span className="sr-only">, {badge} selected</span></>}
                </Link></li>;
              }
              const id = panelId(group);
              const open = openGroup === group.label;
              const Panel = panels[group.panel];
              return <li key={group.label} className={styles.navItem} data-wide={Boolean(group.panel)} onPointerEnter={hoverOpen(group.label)} onPointerLeave={hoverClose}>
                <button type="button" data-group={group.label} className={styles.navLink} data-active={active} aria-expanded={open} aria-controls={id} onClick={(event) => toggleGroup(group.label, event)}>{group.label}<Icon name="chevron" /></button>
                <div id={id} className={group.panel ? styles.megaWide : styles.megaCompact} hidden={!open}>
                  {open && (Panel ? <div className={styles.megaInner}><Panel id={id} onNavigate={closeGroup} /></div> : <MegaResources group={group} onNavigate={closeGroup} />)}
                </div>
              </li>;
            })}
          </ul>
        </nav>
        <div className={styles.actions}>
          <button ref={searchButton} type="button" className={styles.searchTrigger} aria-expanded={searchOpen} aria-controls="header-search" aria-keyshortcuts="/ Control+K Meta+K" onClick={() => { setOpenGroup(null); setSearchOpen(!searchOpen); }}>
            <Icon name={searchOpen ? 'close' : 'search'} /><span className={styles.searchLabel}>{searchOpen ? 'Close search' : 'Search'}</span><kbd aria-hidden="true">/</kbd>
          </button>
          <AccountControl />
          <button className={styles.menuButton} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
        </div>
      </div>
      {searchOpen && <SearchPanel id="header-search" onSubmit={search} onClose={closeSearch} />}
    </header>
    <div className={styles.scrim} data-open={overlay} aria-hidden="true" />

    <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="NSEDU" variant={`dialog--drawer ${styles.drawer}`}>
      <MobileNav pathname={pathname} onSearch={search} onNavigate={() => setMobileOpen(false)} />
    </Dialog>
  </>;
}
