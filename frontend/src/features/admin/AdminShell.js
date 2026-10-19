'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { adminNavigation, findAdminPage } from '@/data/admin-navigation';
import { AdminSessionProvider, useAdminSession } from './AdminSession';
import styles from './AdminShell.module.css';

const initials = (admin) => (admin?.name || admin?.email || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

function Sidebar({ open, onNavigate }) {
  const pathname = usePathname();
  const { admin, logout } = useAdminSession();
  return <aside className={styles.sidebar} data-open={open} aria-label="Admin navigation">
    <div className={styles.sidebarBrand}>
      <span className={styles.brandMark}><Brand variant="mark" tone="light" /></span>
      <span className={styles.label}><strong>Gyaan Vidhya</strong><small>Admin console</small></span>
    </div>
    <nav className={styles.sidebarNav}>
      {adminNavigation.map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || admin?.role !== 'employee') })).filter((group) => group.items.length).map((group) => <div key={group.label} className={styles.group}>
        <p className={styles.groupLabel}><span className={styles.label}>{group.label}</span></p>
        <ul>{group.items.map((item) => {
          const active = pathname === item.href;
          return <li key={item.href}><Link href={item.href} className={styles.item} aria-current={active ? 'page' : undefined} onClick={onNavigate} title={item.label}>
            <span className={styles.itemIcon}><Icon name={item.icon} /></span><span className={styles.label}>{item.label}</span>
          </Link></li>;
        })}</ul>
      </div>)}
    </nav>
    <div className={styles.sidebarFooter}>
      <button type="button" className={styles.item} onClick={logout} title="Log out"><span className={styles.itemIcon}><Icon name="logout" /></span><span className={styles.label}>Log out</span></button>
      <div className={styles.profile}>
        <span className={styles.avatar}>{initials(admin)}</span>
        <span className={styles.label}><strong>{admin?.name || (admin?.role === 'employee' ? 'Employee' : 'Administrator')}</strong><small>{admin?.email}</small></span>
      </div>
    </div>
  </aside>;
}

function Workspace({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, status } = useAdminSession();
  const [open, setOpen] = useState(false);
  const page = findAdminPage(pathname);
  const employeeOutsideWorkspace = admin?.role === 'employee' && !['/admin/reference-students', '/admin/reference-students/new', '/admin/leads'].includes(pathname) && !pathname.startsWith('/admin/leads/');
  useEffect(() => { if (employeeOutsideWorkspace) router.replace('/admin/reference-students'); }, [employeeOutsideWorkspace, router]);
  if (status === 'loading') return <div className={styles.splash} role="status"><span className={styles.splashMark}><Icon name="cap" /></span><p>Opening the admin console…</p></div>;
  if (status === 'unavailable') return <div className={styles.splash} role="alert"><span className={styles.splashMark}><Icon name="shield" /></span><p>The Gyaan Vidhya API is not reachable. Start the backend and reload this page.</p><button type="button" className="button button--primary" onClick={() => window.location.reload()}>Reload</button></div>;
  if (!admin) return null;
  if (employeeOutsideWorkspace) return <div className={styles.splash} role="status"><p>Opening your students…</p></div>;
  return <div className={styles.shell}>
    <Sidebar open={open} onNavigate={() => setOpen(false)} />
    <button type="button" className={styles.scrim} data-open={open} aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <button type="button" className={styles.menuButton} aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <div className={styles.pageTitle}>
          <p className={styles.crumb}>Admin<Icon name="chevron" />{page?.group || 'Console'}</p>
          <h1>{page?.label || 'Admin console'}</h1>
        </div>
        <div className={styles.topActions}>
          {admin.role !== 'employee' && <a className={styles.siteLink} href="/" target="_blank" rel="noopener noreferrer"><Icon name="external" /><span>View site</span></a>}
          <span className={styles.adminChip}><span className={styles.avatar}>{initials(admin)}</span><span><strong>{admin.name || (admin.role === 'employee' ? 'Employee' : 'Administrator')}</strong><small>{admin.role === 'employee' ? 'Employee' : 'Administrator'}</small></span></span>
        </div>
      </header>
      <main id="main" className={styles.content} tabIndex={-1}>{children}</main>
    </div>
  </div>;
}

export default function AdminShell({ children }) {
  return <AdminSessionProvider><Workspace>{children}</Workspace></AdminSessionProvider>;
}
