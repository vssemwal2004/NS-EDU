'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { navigation, cities } from '@/data/landing';
import styles from './Header.module.css';

export default function Header({ city, onCityChange, onBrowse, onTool, onAccount }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrollState, setScrollState] = useState({ section: 'intro', scrolled: false });
  const headerRef = useRef(null);
  const slotRef = useRef(null);
  const closeDetails = () => headerRef.current?.querySelectorAll('details[open]').forEach((node) => { node.open = false; });
  useEffect(() => {
    let frame = 0;
    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const slotHeight = slotRef.current?.getBoundingClientRect().height || 0;
        const destinations = document.getElementById('study-destinations');
        const colleges = document.getElementById('course-colleges');
        const eligibility = document.getElementById('course-eligibility');
        const budget = document.getElementById('college-budget');
        const news = document.getElementById('education-news');
        const compact = !!destinations && destinations.getBoundingClientRect().top <= slotHeight + 48;
        const section = !compact ? 'intro' : news && news.getBoundingClientRect().top <= Math.max(slotHeight + 48, window.innerHeight * .45) ? 'news' : budget && budget.getBoundingClientRect().top <= Math.max(slotHeight + 48, window.innerHeight * .45) ? 'budget' : eligibility && eligibility.getBoundingClientRect().top <= Math.max(slotHeight + 48, window.innerHeight * .45) ? 'eligibility' : colleges && colleges.getBoundingClientRect().top <= slotHeight + 48 ? 'colleges' : 'locations';
        const scrolled = window.scrollY > 8;
        setScrollState((previous) => previous.section === section && previous.scrolled === scrolled ? previous : { section, scrolled });
      });
    }
    function updateOffset() {
      if (headerRef.current) document.documentElement.style.setProperty('--header-scroll-offset', `${headerRef.current.getBoundingClientRect().height}px`);
    }
    const observer = new window.ResizeObserver(updateOffset);
    observer.observe(headerRef.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-scroll-offset');
    };
  }, []);
  useEffect(() => {
    function dismiss(event) {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return;
        headerRef.current?.querySelector('details[open] summary')?.focus();
      } else if (headerRef.current?.contains(event.target) && event.target.closest('details')) return;
      closeDetails();
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, []);
  function select(item) {
    closeDetails(); setMobileOpen(false);
    if (item.tool) onTool(item.tool);
    else onBrowse({ type: item.type, query: item.query || '' });
  }
  function search(event) {
    event.preventDefault(); setMobileOpen(false);
    onBrowse({ type: 'Colleges', query: query.trim() });
  }
  const location = (id) => (
    <label className={styles.location} htmlFor={id}>
      <Icon name="location" /><span className="sr-only">Preferred city</span>
      <select id={id} value={city} onChange={(event) => onCityChange(event.target.value)}>
        <option value="">Select city</option>{cities.map((name) => <option key={name}>{name}</option>)}
      </select><Icon name="chevron" />
    </label>
  );
  return (
    <div className={styles.headerSlot} ref={slotRef}>
    <header className={styles.header} ref={headerRef} data-mode={scrollState.section === 'intro' ? 'full' : 'compact'} data-section={scrollState.section} data-scrolled={scrollState.scrolled}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className={`container ${styles.top}`}>
        <Link className={styles.brand} href="/" aria-label="NSEDU home"><span>NSEDU</span><span className={styles.tagline}>Discover&nbsp; Learn&nbsp; Belong</span><span className={styles.mobileContext} aria-hidden="true">{scrollState.section === 'news' ? 'Education news' : scrollState.section === 'budget' ? 'Budget check' : scrollState.section === 'eligibility' ? 'Eligibility' : scrollState.section === 'colleges' ? 'Colleges' : 'Locations'}</span></Link>
        <form className={styles.globalSearch} role="search" onSubmit={search}>
          <button type="submit" aria-label="Search NSEDU"><Icon name="search" /></button>
          <label className="sr-only" htmlFor="global-search">Search NSEDU</label>
          <input id="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search colleges, courses, exams or anything..." autoComplete="off" maxLength={120} />
        </form>
        <div className={styles.desktopLocation}>{location('header-city')}</div>
        <div className={styles.accounts}>
          <button className={`button button--outline ${styles.login}`} type="button" onClick={() => onAccount('login')}>Log in</button>
          <button className="button button--primary" type="button" onClick={() => onAccount('signup')}>Create account</button>
        </div>
        <button className={`icon-button ${styles.menuButton}`} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
      </div>
      <nav className={`container ${styles.nav}`} aria-label="Main navigation">
        <div className={styles.sectionNav}>
          <a href="#study-destinations" aria-current={scrollState.section === 'locations' ? 'location' : undefined}>Locations</a>
          {scrollState.section === 'news' ? <a href="#education-news" aria-current="location">Education news</a> : scrollState.section === 'budget' ? <a href="#college-budget" aria-current="location">Budget check</a> : scrollState.section === 'eligibility' ? <a href="#course-eligibility" aria-current="location">Eligibility check</a> : <a href="#course-colleges" aria-current={scrollState.section === 'colleges' ? 'location' : undefined}>Course-wise colleges</a>}
        </div>
        {navigation.map((group, index) => group.items ? (
          <details key={group.label} className={`${styles.navGroup} ${index === 0 ? styles.active : ''}`} onToggle={(event) => {
            if (!event.currentTarget.open) return;
            headerRef.current?.querySelectorAll('details[open]').forEach((other) => { if (other !== event.currentTarget) other.open = false; });
          }}>
            <summary>{group.label}<Icon name="chevron" /></summary>
            <div className={`surface ${styles.dropdown}`}><p className="eyebrow">{group.label}</p>{group.items.map((item) => <button key={item.label} type="button" onClick={() => select(item)}>{item.label}<Icon name="arrow" /></button>)}</div>
          </details>
        ) : <button key={group.label} className={styles.navLink} type="button" onClick={() => select(group)}>{group.label}{group.label !== 'Compare' && <Icon name="chevron" />}</button>)}
      </nav>
      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="NSEDU" variant="dialog--drawer">
        <div id="mobile-navigation" className={styles.mobileNav}>
          <form role="search" onSubmit={search} className={styles.mobileSearch}><label className="sr-only" htmlFor="mobile-search">Search NSEDU</label><input id="mobile-search" className="field" placeholder="Search colleges, courses or exams" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} /><button className="icon-button" type="submit" aria-label="Search NSEDU"><Icon name="search" /></button></form>
          {location('mobile-city')}
          <nav aria-label="Mobile navigation">
            {navigation.map((group) => group.items ? <details key={group.label} className={styles.mobileGroup}><summary>{group.label}<Icon name="chevron" /></summary><div>{group.items.map((item) => <button key={item.label} type="button" onClick={() => select(item)}>{item.label}<Icon name="arrow" /></button>)}</div></details> : <button key={group.label} className={styles.mobileLink} type="button" onClick={() => select(group)}>{group.label}<Icon name="arrow" /></button>)}
          </nav>
          <button className="button button--outline" type="button" onClick={() => { setMobileOpen(false); onAccount('login'); }}>Log in to your account</button>
          <p className={styles.mobileNote}>A thoughtful choice starts here.</p>
        </div>
      </Dialog>
    </header>
    </div>
  );
}
