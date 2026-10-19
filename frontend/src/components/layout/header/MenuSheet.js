'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { isActivePath, primaryNavigation, supportLinks, toolLinks } from '@/data/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import styles from './MenuSheet.module.css';

const mainLinks = primaryNavigation.filter((item) => item.id !== 'tools');

// Full-screen mobile menu (native modal <dialog>: focus trap, Escape and inert background for free).
export default function MenuSheet({ id, open, pathname, compareCount, onClose, onSearch }) {
  const dialog = useRef(null);
  const { student, openLogin, signOut } = useStudentAuth();

  useEffect(() => {
    const node = dialog.current;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const current = (href) => (isActivePath(pathname, { match: [href] }) ? 'page' : undefined);

  return <dialog ref={dialog} id={id} className={styles.sheet} aria-label="Site menu"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={() => { if (open) onClose(); }}>
    <div className={styles.top}>
      <Link href="/" className={styles.brand} onClick={onClose} aria-label="Gyaan Vidhya home"><Brand /></Link>
      <button type="button" className={styles.close} aria-label="Close menu" onClick={onClose}><Icon name="close" /></button>
    </div>

    <div className={styles.body}>
      <form role="search" className={styles.search} onSubmit={(event) => { event.preventDefault(); onSearch(new FormData(event.currentTarget).get('q')?.toString().trim() || ''); }}>
        <Icon name="search" />
        <label className="sr-only" htmlFor={`${id}-search`}>Search Gyaan Vidhya</label>
        <input id={`${id}-search`} name="q" type="search" placeholder="University, course or exam" maxLength={120} autoComplete="off" enterKeyHint="search" />
        <button type="submit" aria-label="Search"><Icon name="arrow" /></button>
      </form>

      <section className={`lux-surface-dark ${styles.cta}`} aria-labelledby={`${id}-cta`}>
        <p className="lux-eyebrow lux-eyebrow--rule">Start here</p>
        <h2 id={`${id}-cta`} className={styles.ctaTitle}>Find your university</h2>
        <p className={styles.ctaText}>Search, shortlist and apply in one place.</p>
        <Link className="lux-button lux-button--gold lux-button--block" href="/universities" onClick={onClose}>Find universities<Icon name="arrow" /></Link>
      </section>

      <nav aria-label="Main navigation" className={styles.nav}>
        <ul className={styles.links}>
          {mainLinks.map((item) => <li key={item.id}><Link href={item.href} onClick={onClose} aria-current={isActivePath(pathname, item) ? 'page' : undefined}>
            <span className={styles.linkIcon}><Icon name={item.icon} /></span>{item.label}
            {item.badge === 'compare' && compareCount > 0 && <em>{compareCount}<span className="sr-only"> selected</span></em>}
            <Icon name="chevron" className={styles.chevron} />
          </Link></li>)}
        </ul>
        <p className="lux-eyebrow" id={`${id}-tools`}>Tools</p>
        <ul className={styles.tools} aria-labelledby={`${id}-tools`}>
          {toolLinks.map((tool) => <li key={tool.href}><Link href={tool.href} onClick={onClose} aria-current={current(tool.href)}>
            <Icon name={tool.icon} /><strong>{tool.label}</strong><small>{tool.description}</small>
          </Link></li>)}
        </ul>
      </nav>

      <div className={styles.account}>
        {student
          ? <>
            <p className={styles.who}><span className={styles.avatar} aria-hidden="true">{(student.name || student.email || 'S')[0].toUpperCase()}</span><span><strong>{student.name || 'Gyaan Vidhya student'}</strong><small>{student.email || student.phone}</small></span></p>
            <div className={styles.accountActions}>
              <Link className="lux-button lux-button--outline" href="/account" onClick={onClose}>My account</Link>
              <button className="lux-button lux-button--ghost" type="button" onClick={() => { onClose(); signOut(); }}>Log out</button>
            </div>
          </>
          : <>
            <p className={styles.accountText}>Log in with a one-time code sent to your email. New here? Your account is created on first login.</p>
            <button className="lux-button lux-button--primary lux-button--block" type="button" onClick={() => { onClose(); openLogin(); }}><Icon name="user" />Log in</button>
          </>}
      </div>

      <ul className={styles.support}>
        {supportLinks.map((link) => <li key={link.href}><Link href={link.href} onClick={onClose} aria-current={current(link.href)}>{link.label}</Link></li>)}
      </ul>
    </div>
  </dialog>;
}
