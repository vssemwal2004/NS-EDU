'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import styles from '../Header.module.css';

const initials = (student) => (student?.name || student?.email || 'S').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
const displayName = (student) => student?.name?.split(' ')[0] || 'My account';

// Log in button, or an avatar with a role=menu that supports arrow keys.
export default function AccountControl() {
  const { student, status, openLogin, signOut } = useStudentAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  const items = () => [...(ref.current?.querySelectorAll('[role="menuitem"]') || [])];

  useEffect(() => {
    if (!open) return undefined;
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const onPointer = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (status === 'loading') return <span className={styles.accountSkeleton} aria-hidden="true" />;
  // Logged out: the login popup everywhere (the page stays put); on /login itself the form is already there.
  if (!student) {
    if (pathname === '/login') return null;
    return <button type="button" className={styles.loginButton} aria-haspopup="dialog" onClick={() => openLogin()}><Icon name="user" /><span>Log in</span></button>;
  }

  const onMenuKey = (event) => {
    const list = items();
    const current = list.indexOf(document.activeElement);
    const targets = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: list.length - 1 };
    if (event.key in targets) { event.preventDefault(); list[(targets[event.key] + list.length) % list.length]?.focus(); }
    if (event.key === 'Tab') setOpen(false);
  };
  const close = () => setOpen(false);

  return <div className={styles.account} ref={ref}>
    <button ref={trigger} type="button" className={styles.avatarButton} aria-expanded={open} aria-haspopup="menu" aria-controls="header-account-menu" onClick={() => setOpen(!open)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } }}>
      <span className={styles.avatar} aria-hidden="true">{initials(student)}</span><span className={styles.accountName}>{displayName(student)}</span><Icon name="chevron" />
    </button>
    {open && <div id="header-account-menu" className={styles.accountMenu} role="menu" aria-label="Account" onKeyDown={onMenuKey}>
      <p className={styles.accountMeta} role="presentation"><strong>{student.name || 'Gyaan Vidhya student'}</strong><span>{student.email || student.phone}</span></p>
      <Link role="menuitem" tabIndex={-1} href="/account#applications" onClick={close}><Icon name="eligibility" />My applications</Link>
      <button role="menuitem" tabIndex={-1} type="button" onClick={() => { close(); signOut(); }}><Icon name="logout" />Log out</button>
    </div>}
  </div>;
}
