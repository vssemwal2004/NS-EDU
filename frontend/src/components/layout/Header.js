'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { primaryNavigation, toolLinks, isActivePath } from '@/data/navigation';
import { useCatalog } from '@/providers/CatalogProvider';
import AccountControl from './header/AccountControl';
import MenuSheet from './header/MenuSheet';
import NavMenu from './header/NavMenu';
import SearchPanel from './header/SearchPanel';
import { useCompareSummary } from './header/storage';
import styles from './Header.module.css';

const isTyping = (target) => /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;

// Light dropdown contents, built from the live catalogue (nothing invented: empty catalogue → link only).
function useMenus() {
  const { courses = [], exams = [] } = useCatalog();
  return {
    courses: { columns: 2, items: courses.map((course) => ({ href: `/courses/${encodeURIComponent(course.id)}`, label: course.name, description: course.fullName || course.field, icon: course.icon })), footer: { href: '/courses', label: 'All courses' } },
    exams: { items: exams.map((exam) => ({ href: `/exams/${encodeURIComponent(exam.id)}`, label: exam.name, description: `${exam.field} entrance exam`, icon: exam.icon })), footer: { href: '/exams', label: 'All exam guides' } },
    tools: { items: toolLinks },
  };
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const compare = useCompareSummary();
  const menus = useMenus();
  const [openMenu, setOpenMenu] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const searchButton = useRef(null);
  const timers = useRef({ open: 0, close: 0, at: 0 });

  // Close everything transient when the route changes (adjust-state-on-prop-change pattern).
  const [routeKey, setRouteKey] = useState(pathname);
  if (routeKey !== pathname) { setRouteKey(pathname); setOpenMenu(null); setSearchOpen(false); setSheetOpen(false); }

  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setScrolled(window.scrollY > 4); };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    const pending = timers.current;
    return () => { window.removeEventListener('scroll', schedule); window.cancelAnimationFrame(frame); window.clearTimeout(pending.open); window.clearTimeout(pending.close); };
  }, []);

  // "/" (outside fields) and Ctrl/Cmd+K open search.
  useEffect(() => {
    function onKey(event) {
      const slash = event.key === '/' && !isTyping(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey;
      const commandK = event.key?.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!slash && !commandK) return;
      event.preventDefault();
      setOpenMenu(null);
      setSearchOpen(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // An open dropdown closes on Escape (focus returns to its trigger) and on an outside press.
  useEffect(() => {
    if (!openMenu) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      navRef.current?.querySelector(`[data-menu="${openMenu}"]`)?.focus();
      setOpenMenu(null);
    }
    function onPointer(event) { if (!navRef.current?.contains(event.target)) setOpenMenu(null); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [openMenu]);

  // Mouse hover intent: open after a short pause, close shortly after leaving.
  const hoverOpen = (id) => (event) => {
    if (event.pointerType !== 'mouse' || searchOpen) return;
    window.clearTimeout(timers.current.close);
    window.clearTimeout(timers.current.open);
    if (openMenu === id) return;
    const delay = openMenu ? 60 : 120;
    const openedAt = event.timeStamp + delay;
    timers.current.open = window.setTimeout(() => { timers.current.at = openedAt; setOpenMenu(id); }, delay);
  };
  const hoverClose = (event) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(timers.current.open);
    timers.current.close = window.setTimeout(() => setOpenMenu(null), 180);
  };
  const toggleMenu = (id, event) => {
    window.clearTimeout(timers.current.open);
    // A click right after hover opened the menu should not close it again.
    if (openMenu === id && event.timeStamp - timers.current.at < 450) return;
    setSearchOpen(false);
    setOpenMenu(openMenu === id ? null : id);
  };
  const closeSearch = (returnFocus) => { setSearchOpen(false); if (returnFocus) searchButton.current?.focus(); };
  const search = (query) => { setSearchOpen(false); setSheetOpen(false); router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search'); };

  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className={styles.header} data-scrolled={scrolled} data-raised={searchOpen || Boolean(openMenu)}>
      <div className={`lux-container lux-container--wide ${styles.bar}`}>
        <Link className={styles.brand} href="/" aria-label="Gyaan Vidhya home"><Brand priority /></Link>

        <nav className={styles.nav} aria-label="Main navigation" ref={navRef}>
          <ul>
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item);
              if (!item.menu) {
                const badge = item.badge === 'compare' ? compare.count : 0;
                const href = item.badge === 'compare' && compare.courseId ? `${item.href}?course=${encodeURIComponent(compare.courseId)}` : item.href;
                return <li key={item.id}><Link className={styles.navLink} href={href} aria-current={active ? 'page' : undefined}>
                  {item.label}{badge > 0 && <><span className={styles.badge} aria-hidden="true">{badge}</span><span className="sr-only">, {badge} selected</span></>}
                </Link></li>;
              }
              const open = openMenu === item.id;
              const id = `nav-menu-${item.id}`;
              return <li key={item.id} className={styles.menuItem} onPointerEnter={hoverOpen(item.id)} onPointerLeave={hoverClose}>
                <button type="button" data-menu={item.id} className={styles.navLink} data-active={active} aria-expanded={open} aria-controls={id} onClick={(event) => toggleMenu(item.id, event)}>
                  {item.label}<Icon name="chevron" />
                </button>
                <div id={id} className={styles.dropdown} data-menu={item.id} hidden={!open}>
                  {open && <NavMenu {...menus[item.menu]} label={item.label} onNavigate={() => setOpenMenu(null)} />}
                </div>
              </li>;
            })}
          </ul>
        </nav>

        <div className={styles.actions}>
          <button ref={searchButton} type="button" className={styles.searchTrigger} aria-expanded={searchOpen} aria-controls="header-search" aria-keyshortcuts="/ Control+K Meta+K"
            onClick={() => { setOpenMenu(null); setSearchOpen(!searchOpen); }}>
            <Icon name={searchOpen ? 'close' : 'search'} /><span className={styles.searchLabel}>{searchOpen ? 'Close search' : 'Search'}</span><kbd aria-hidden="true">/</kbd>
          </button>
          <AccountControl />
          <button className={styles.menuButton} type="button" aria-label="Open menu" aria-expanded={sheetOpen} aria-controls="site-menu" onClick={() => { setSearchOpen(false); setSheetOpen(true); }}><Icon name="menu" /></button>
        </div>
      </div>
      {searchOpen && <SearchPanel id="header-search" onSubmit={search} onClose={closeSearch} />}
    </header>
    <div className={styles.scrim} data-open={searchOpen} aria-hidden="true" onClick={() => closeSearch(false)} />
    <MenuSheet id="site-menu" open={sheetOpen} pathname={pathname} compareCount={compare.count} onClose={() => setSheetOpen(false)} onSearch={search} />
  </>;
}
